import { useState } from 'react';

import Editor from '@monaco-editor/react';

function MonacoEditor() {
    const [code, setCode] = useState(getLocalStorage());

    function handleEditorChange(value : string | undefined) : void {
        if(value != undefined) {
            setCode(value);
            localStorage.setItem('code', value);
        }
    }

    function getLocalStorage() : string {
        return localStorage.getItem('code') ?? '// some comment';
    }

    return <Editor
        height="100%"
        theme="vs-dark"
        defaultLanguage="javascript"
        onChange={handleEditorChange}
        value={code}
    />;
}

export default MonacoEditor;