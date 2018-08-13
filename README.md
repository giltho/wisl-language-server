# WISL Language Server

ThiS Language server is used to color and diagnose WISL code

## Functionality

This Language Server works for plain text file. It has the following language features:
- Syntax Coloring
- Diagnostics regenerated on each file change or configuration change

## Structure

```
.
├── License.txt
├── README.md
├── client
│   ├── package-lock.json
│   ├── package.json
│   ├── src
│   │   └── extension.ts
│   └── tsconfig.json
├── language-configuration.json
├── package-lock.json
├── package.json
├── server
│   ├── package-lock.json
│   ├── package.json
│   ├── src
│   │   └── server.ts
│   └── tsconfig.json
├── syntaxes
│   └── wisl.tmLanguage.json
└── tsconfig.base.json
```