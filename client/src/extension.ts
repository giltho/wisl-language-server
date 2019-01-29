/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { workspace, 
	OutputChannel } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions
} from 'vscode-languageclient';

import * as WebSocket from 'ws';

let client: LanguageClient;

export function activate() {
	// The server is implemented in node
	let binaryLocation:string = workspace.getConfiguration('wisl').get('binaryPath')
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
					command: binaryLocation,
					args: []
			};
	
	const socket = new WebSocket(`ws://localhost:7000`);
	let log = '';
	const websocketOutputChannel : OutputChannel = {
		name: 'websocket',
		// Only append the logs but send them later
		append(value: string) {
			log += value
		},
		appendLine(value: string) {
			log += value
			console.log(log)
			// Don't send logs until WebSocket initialization
			if (socket && socket.readyState === WebSocket.OPEN) {
				socket.send(log)
			}
			log = ''
		},
		clear() {},
		show() {},
		hide() {},
		dispose() {}
	}

	console.log(websocketOutputChannel);


	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'wisl' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		},
		// outputChannel: websocketOutputChannel
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'wisl',
		'WISL Language Server',
		serverOptions,
		clientOptions
	);
	
	if (! workspace.getConfiguration('wisl').get('useServer')) {
		// Options that allows to not start the server
		return;
	}
	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
