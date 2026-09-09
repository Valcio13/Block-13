// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal contest-MVP registry. The seed adapter will be connected to
/// Hemi Bitcoin Kit data after the game loop is playable and tested.
contract RunRegistry {
    struct Run {
        bytes32 seed;
        uint64 startedAt;
        uint64 submittedAt;
        uint32 score;
        bool submitted;
    }

    mapping(address player => uint256 nonce) public nextNonce;
    mapping(address player => mapping(uint256 nonce => Run)) public runs;

    event RunStarted(address indexed player, uint256 indexed nonce, bytes32 seed);
    event ScoreSubmitted(address indexed player, uint256 indexed nonce, uint32 score, bytes32 actionHash);

    function startRun() external returns (uint256 nonce, bytes32 seed) {
        nonce = nextNonce[msg.sender]++;
        seed = keccak256(abi.encodePacked(block.prevrandao, blockhash(block.number - 1), msg.sender, nonce));
        runs[msg.sender][nonce] = Run({
            seed: seed,
            startedAt: uint64(block.timestamp),
            submittedAt: 0,
            score: 0,
            submitted: false
        });
        emit RunStarted(msg.sender, nonce, seed);
    }

    function submitScore(uint256 nonce, uint32 score, bytes32 actionHash) external {
        Run storage run = runs[msg.sender][nonce];
        require(run.startedAt != 0, "Unknown run");
        require(!run.submitted, "Run already submitted");
        require(block.timestamp >= uint256(run.startedAt) + 60, "Run too short");

        run.submitted = true;
        run.submittedAt = uint64(block.timestamp);
        run.score = score;
        emit ScoreSubmitted(msg.sender, nonce, score, actionHash);
    }
}
