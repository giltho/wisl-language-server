/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import { existsSync } from "fs";

import { execSync } from "child_process";

import {
  createConnection,
  TextDocuments,
  TextDocument,
  Diagnostic,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  CodeLens
} from "vscode-languageserver";

import * as support from "./support";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
// let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings
  hasConfigurationCapability =
    capabilities.workspace && !!capabilities.workspace.configuration;
  hasWorkspaceFolderCapability =
    capabilities.workspace && !!capabilities.workspace.workspaceFolders;
  // hasDiagnosticRelatedInformationCapability =
  //  	capabilities.textDocument &&
  //  	capabilities.textDocument.publishDiagnostics &&
  //  	capabilities.textDocument.publishDiagnostics.relatedInformation;

  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      // Tell the client that the server supports code completion
      // completionProvider: {
      //   resolveProvider: false
      // }
      codeLensProvider : {
        resolveProvider: true
      }
    }
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

// The example settings
interface WislSettings {
  binaryPath: string;
  debugMode: boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
 const defaultSettings: WislSettings = { binaryPath: "wisl", debugMode: false };
 let globalSettings: WislSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<WislSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
     globalSettings = <WislSettings>(
     	(change.settings.wisl || defaultSettings)
     );
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<WislSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'wisl'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  // The validator creates diagnostics for all uppercase words length 2 and more
  let settings = await getDocumentSettings(textDocument.uri)
  if (!existsSync(settings.binaryPath)) {
    return;
  }
  let text = textDocument.getText();
  let result = "[]";
  try {
      result = execSync(`${settings.binaryPath} -uri ${textDocument.uri} ${settings.debugMode ? "-debug" : ""}`, {
      input: text,
      encoding: "utf8"
    }).toString();

    const diagnostics: Diagnostic[] = JSON.parse(result).diagnostics;
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  } catch (e) {
    const diagnostics: Diagnostic[] = [];
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    connection.window.showErrorMessage(e.toString());
  }
}

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    return [
      {
        label: "TypeScript",
        kind: CompletionItemKind.Text,
        data: 1
      },
      {
        label: "JavaScript",
        kind: CompletionItemKind.Text,
        data: 2
      }
    ];
  }
);

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    if (item.data === 1) {
      (item.detail = "TypeScript details"),
        (item.documentation = "TypeScript documentation");
    } else if (item.data === 2) {
      (item.detail = "JavaScript details"),
        (item.documentation = "JavaScript documentation");
    }
    return item;
  }
);


connection.onCodeLens(
  support.cancellableHandler(async ({ textDocument }) => {
    // The validator creates diagnostics for all uppercase words length 2 and more
    let settings = await getDocumentSettings(textDocument.uri)
    let document = documents.get(textDocument.uri);
    if (!(existsSync(settings.binaryPath) && document)) {
      return null;
    }
    let text = document.getText();
    let result = "[]";
    try {
        result = execSync(`${settings.binaryPath} -uri ${textDocument.uri} ${settings.debugMode ? "-debug" : ""}`, {
        input: text,
        encoding: "utf8"
      }).toString();

      const codeLenses : CodeLens[] = JSON.parse(result).codeLenses;
      return codeLenses;
    } catch (e) {
      return null;
    }
  })
)

connection.onCodeLensResolve(
  support.cancellableHandler(async /* (codelens, { textDocument })*/ () => {
    console.log("TEST");
    const codeLens : CodeLens|null = null;
    return codeLens;
  })
)


/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
