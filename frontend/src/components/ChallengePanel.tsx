function ChallengePanel() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold border-b border-gray-700 pb-2">
                Challenge 1: Two Sum
            </h2>

            <p className="text-gray-300">
                Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to target.
            </p>
            <p className="text-gray-300">
                You may assume that each input would have exactly one solution, and you may not use the same element twice.
            </p>
            <p className="font-semibold text-lg text-yellow-400">
                You can return the answer in any order.
            </p>

            <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                <h3 className="font-bold text-lg">Example 1:</h3>
                <pre className="text-sm">
                    <strong>Input:</strong> nums = [2,7,11,15], target = 9
                    <br />
                    <strong>Output:</strong> [0,1]
                    <br />
                    <strong>Explanation:</strong> Because nums[0] + nums[1] == 9, we return [0, 1].
                </pre>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                <h3 className="font-bold text-lg">Example 2:</h3>
                <pre className="text-sm">
                    <strong>Input:</strong> nums = [3,2,4], target = 6
                    <br />
                    <strong>Output:</strong> [1,2]
                </pre>
            </div>

            <p className="text-gray-400 pt-4 border-t border-gray-700 italic">
                Follow-up: Can you come up with an algorithm that is less than O(n²) time complexity?
            </p>
        </div>
    );
}

export default ChallengePanel;