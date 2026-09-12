// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Block 13 Run Registry
/// @notice Stores run manifests with multi-chain entropy sources for deterministic gameplay
/// @dev Uses BTC, Hemi, and Ethereum block hashes for independent RNG seeds
contract RunRegistry {
    /// @notice Game modes supported
    enum GameMode {
        CLASSIC,      // Standard survival horror
        SPEEDRUN,     // Time-based scoring
        HARDCORE      // Permadeath, no continues
    }

    /// @notice Run manifest containing all entropy sources and metadata
    struct RunManifest {
        // Identity
        address player;
        uint256 runId;           // Player's nonce for this run
        
        // Game configuration
        GameMode gameMode;
        bytes32 gameVersion;     // Semantic version hash (e.g., keccak256("0.1.0"))
        bytes32 character;       // Character selection hash
        bytes32 rulesHash;       // Game rules/settings hash
        
        // Multi-chain entropy sources
        bytes32 btcBlockHash;    // Bitcoin block hash (WORLD seed source)
        bytes32 hemiBlockHash;   // Hemi block hash (WORLD seed source)
        bytes32 ethBlockHash;    // Ethereum block hash (ECONOMY seed source)
        bytes32 hemiTxHash;      // Existing Hemi tx hash (EVENT seed source)
        
        // Timing
        uint64 startedAt;
        uint64 submittedAt;
        
        // Scoring
        uint32 score;
        bool submitted;
    }

    mapping(address player => uint256 nonce) public nextNonce;
    mapping(address player => mapping(uint256 nonce => RunManifest)) public runs;

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
    
    event ScoreSubmitted(
        address indexed player,
        uint256 indexed runId,
        uint32 score,
        bytes32 actionHash
    );

    /// @notice Start a new run with multi-chain entropy sources
    /// @param gameMode The game mode for this run
    /// @param gameVersion Hash of game version (e.g., keccak256("0.1.0"))
    /// @param character Character selection hash
    /// @param rulesHash Game rules/settings hash
    /// @param btcBlockHash Recent Bitcoin block hash
    /// @param hemiBlockHash Recent Hemi block hash (not this tx's block)
    /// @param ethBlockHash Recent Ethereum block hash
    /// @param hemiTxHash Existing confirmed Hemi transaction hash (for event seed)
    /// @return runId The nonce/ID for this run
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
        // Validate entropy sources are non-zero
        require(btcBlockHash != bytes32(0), "Invalid BTC block hash");
        require(hemiBlockHash != bytes32(0), "Invalid Hemi block hash");
        require(ethBlockHash != bytes32(0), "Invalid ETH block hash");
        require(hemiTxHash != bytes32(0), "Invalid Hemi tx hash");
        require(gameVersion != bytes32(0), "Invalid game version");
        require(rulesHash != bytes32(0), "Invalid rules hash");

        runId = nextNonce[msg.sender]++;

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
            startedAt: uint64(block.timestamp),
            submittedAt: 0,
            score: 0,
            submitted: false
        });

        emit RunStarted(
            msg.sender,
            runId,
            gameMode,
            gameVersion,
            btcBlockHash,
            hemiBlockHash,
            ethBlockHash,
            hemiTxHash
        );
    }

    /// @notice Submit final score for a run
    /// @param runId The run ID (nonce)
    /// @param score Final score achieved
    /// @param actionHash Hash of gameplay actions as proof
    function submitScore(uint256 runId, uint32 score, bytes32 actionHash) external {
        RunManifest storage run = runs[msg.sender][runId];
        require(run.startedAt != 0, "Unknown run");
        require(!run.submitted, "Run already submitted");
        require(block.timestamp >= uint256(run.startedAt) + 60, "Run too short");

        run.submitted = true;
        run.submittedAt = uint64(block.timestamp);
        run.score = score;
        
        emit ScoreSubmitted(msg.sender, runId, score, actionHash);
    }

    /// @notice Get run manifest for a player
    /// @param player Player address
    /// @param runId Run ID (nonce)
    /// @return manifest The complete run manifest
    function getRunManifest(address player, uint256 runId) 
        external 
        view 
        returns (RunManifest memory manifest) 
    {
        return runs[player][runId];
    }
}
