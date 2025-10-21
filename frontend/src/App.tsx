import ChallengePanel from "./components/ChallengePanel.tsx";
import MonacoEditor from "./components/MonacoEditor.tsx";

function App() {
    return (
        <div className="flex h-screen bg-gray-900 text-white">

            <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-700">
                <ChallengePanel />
            </div>

            <div className="w-1/2 h-full">
                <MonacoEditor />
            </div>
        </div>
    );
}

export default App;