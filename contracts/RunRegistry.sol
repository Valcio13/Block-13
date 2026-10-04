// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Block 13 Run Registry
/// @notice Stores TX1 run manifests and TX2 deterministic result commitments.
/// @dev TX2 commits replay/result hashes; it does not prove gameplay execution.
contract RunRegistry {
    enum GameMode { CLASSIC, SPEEDRUN, HARDCORE }
    // Values match FinalStateV1: 0 = won, 1 = lost.
    enum Outcome { WON, LOST }

    /// @notice TX1 manifest fields. Completion data is stored separately.
    struct RunManifest {
        address player;
        uint256 runId;
        GameMode gameMode;
        bytes32 gameVersion;
        bytes32 character;
        bytes32 rulesHash;
        bytes32 btcBlockHash;
        bytes32 hemiBlockHash;
        bytes32 ethBlockHash;
        bytes32 hemiTxHash;
        uint64 startedAt;
    }

    struct CompletedRun {
        bool completed;
        uint32 score;
        Outcome outcome;
        uint32 terminalTick;
        bytes32 inputHash;
        bytes32 finalStateHash;
        uint64 completedAt;
    }

    mapping(address player => uint256 nonce) public nextNonce;
    mapping(address player => bool exhausted) private nonceExhausted;
    mapping(address player => mapping(uint256 runId => RunManifest)) public runs;
    mapping(address player => mapping(uint256 runId => bool exists)) private runExists;
    mapping(address player => mapping(uint256 runId => CompletedRun result)) private completedRuns;

    event RunStarted(
        address indexed player,
        uint256 indexed runId,
        GameMode gameMode,
        bytes32 gameVersion,
        bytes32 btcBlockHash,
        bytes32 hemiBlockHash,
        bytes32 ethBlockHash,
        bytes32 hemiTxHash
    );

    event RunCompleted(
        uint256 indexed runId,
        address indexed player,
        uint32 score,
        uint8 outcome,
        uint32 terminalTick,
        bytes32 inputHash,
        bytes32 finalStateHash
    );

    function startRun(
        GameMode gameMode,
        bytes32 gameVersion,
        bytes32 character,
        bytes32 rulesHash,
        bytes32 btcBlockHash,
        bytes32 hemiBlockHash,
        bytes32 ethBlockHash,
        bytes32 hemiTxHash
    ) external returns (uint256 runId) {
        require(!nonceExhausted[msg.sender], "Run IDs exhausted");
        require(btcBlockHash != bytes32(0), "Invalid BTC block hash");
        require(hemiBlockHash != bytes32(0), "Invalid Hemi block hash");
        require(ethBlockHash != bytes32(0), "Invalid ETH block hash");
        require(hemiTxHash != bytes32(0), "Invalid Hemi tx hash");
        require(gameVersion != bytes32(0), "Invalid game version");
        require(rulesHash != bytes32(0), "Invalid rules hash");
        runId = nextNonce[msg.sender];
        if (runId == type(uint256).max) nonceExhausted[msg.sender] = true;
        else nextNonce[msg.sender] = runId + 1;

        runs[msg.sender][runId] = RunManifest({
            player: msg.sender,
            runId: runId,
            gameMode: gameMode,
            gameVersion: gameVersion,
            character: character,
            rulesHash: rulesHash,
            btcBlockHash: btcBlockHash,
            hemiBlockHash: hemiBlockHash,
            ethBlockHash: ethBlockHash,
            hemiTxHash: hemiTxHash,
            startedAt: uint64(block.timestamp)
        });
        runExists[msg.sender][runId] = true;
        emit RunStarted(msg.sender, runId, gameMode, gameVersion, btcBlockHash, hemiBlockHash, ethBlockHash, hemiTxHash);
    }

    /// @notice Commit the canonical terminal state and replay hashes for a run.
    /// @dev FinalStateV1 specifies score:uint32, outcome:uint8, terminalTick:uint32.
    function completeRun(
        uint256 runId,
        uint32 score,
        uint8 outcome,
        uint32 terminalTick,
        bytes32 inputHash,
        bytes32 finalStateHash
    ) external {
        require(runExists[msg.sender][runId], "Unknown run");
        CompletedRun storage result = completedRuns[msg.sender][runId];
        require(!result.completed, "Run already completed");
        require(outcome <= uint8(Outcome.LOST), "Invalid outcome");
        require(terminalTick > 0, "Invalid terminal tick");
        require(inputHash != bytes32(0), "Invalid input hash");
        require(finalStateHash != bytes32(0), "Invalid final state hash");

        result.completed = true;
        result.score = score;
        result.outcome = Outcome(outcome);
        result.terminalTick = terminalTick;
        result.inputHash = inputHash;
        result.finalStateHash = finalStateHash;
        result.completedAt = uint64(block.timestamp);
        emit RunCompleted(runId, msg.sender, score, outcome, terminalTick, inputHash, finalStateHash);
    }

    function getRunManifest(address player, uint256 runId) external view returns (RunManifest memory manifest) {
        return runs[player][runId];
    }

    function getCompletedRun(address player, uint256 runId) external view returns (CompletedRun memory result) {
        require(runExists[player][runId], "Unknown run");
        return completedRuns[player][runId];
    }
}
