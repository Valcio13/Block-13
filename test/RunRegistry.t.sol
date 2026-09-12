// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/RunRegistry.sol";

contract RunRegistryTest is Test {
    RunRegistry public registry;
    address public player1 = address(0x1);
    address public player2 = address(0x2);

    // Sample entropy sources
    bytes32 btcHash = keccak256("bitcoin_block");
    bytes32 hemiHash = keccak256("hemi_block");
    bytes32 ethHash = keccak256("ethereum_block");
    bytes32 txHash = keccak256("hemi_tx");
    bytes32 gameVersion = keccak256("0.1.0");
    bytes32 rulesHash = keccak256("default_rules");
    bytes32 character = keccak256("survivor");

    function setUp() public {
        registry = new RunRegistry();
    }

    function testStartRun() public {
        vm.prank(player1);
        uint256 runId = registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        assertEq(runId, 0, "First runId should be 0");
        
        RunRegistry.RunManifest memory manifest = registry.getRunManifest(player1, runId);
        assertEq(manifest.player, player1, "Player should match");
        assertEq(manifest.runId, runId, "RunId should match");
        assertEq(uint8(manifest.gameMode), uint8(RunRegistry.GameMode.CLASSIC), "Game mode should match");
        assertEq(manifest.btcBlockHash, btcHash, "BTC hash should match");
        assertEq(manifest.hemiBlockHash, hemiHash, "Hemi hash should match");
        assertEq(manifest.ethBlockHash, ethHash, "ETH hash should match");
        assertEq(manifest.hemiTxHash, txHash, "Tx hash should match");
        assertEq(manifest.startedAt, block.timestamp, "Started time should match");
        assertFalse(manifest.submitted, "Should not be submitted");
    }

    function testMultipleRuns() public {
        vm.startPrank(player1);
        
        uint256 runId1 = registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        uint256 runId2 = registry.startRun(
            RunRegistry.GameMode.SPEEDRUN,
            gameVersion,
            character,
            rulesHash,
            keccak256("btc2"),
            keccak256("hemi2"),
            keccak256("eth2"),
            keccak256("tx2")
        );
        
        assertEq(runId1, 0, "First runId should be 0");
        assertEq(runId2, 1, "Second runId should be 1");
        assertEq(registry.nextNonce(player1), 2, "Next nonce should be 2");
        
        vm.stopPrank();
    }

    function testDifferentPlayersSeparateNonces() public {
        vm.prank(player1);
        uint256 runId1 = registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        vm.prank(player2);
        uint256 runId2 = registry.startRun(
            RunRegistry.GameMode.HARDCORE,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        assertEq(runId1, 0, "Player 1 first runId should be 0");
        assertEq(runId2, 0, "Player 2 first runId should be 0");
    }

    function testSubmitScore() public {
        vm.startPrank(player1);
        uint256 runId = registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        vm.warp(block.timestamp + 61);
        
        uint32 score = 500;
        bytes32 actionHash = keccak256(abi.encodePacked(runId, score, block.timestamp));
        
        registry.submitScore(runId, score, actionHash);
        
        RunRegistry.RunManifest memory manifest = registry.getRunManifest(player1, runId);
        assertTrue(manifest.submitted, "Should be marked as submitted");
        assertEq(manifest.score, score, "Score should match");
        assertEq(manifest.submittedAt, block.timestamp, "Submitted time should match");
        
        vm.stopPrank();
    }

    function testCannotSubmitTooQuickly() public {
        vm.startPrank(player1);
        uint256 runId = registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        vm.warp(block.timestamp + 30);
        
        vm.expectRevert("Run too short");
        registry.submitScore(runId, 500, bytes32(0));
        
        vm.stopPrank();
    }

    function testCannotSubmitTwice() public {
        vm.startPrank(player1);
        uint256 runId = registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        vm.warp(block.timestamp + 61);
        
        registry.submitScore(runId, 500, bytes32(0));
        
        vm.expectRevert("Run already submitted");
        registry.submitScore(runId, 600, bytes32(0));
        
        vm.stopPrank();
    }

    function testCannotSubmitUnknownRun() public {
        vm.prank(player1);
        vm.expectRevert("Unknown run");
        registry.submitScore(999, 500, bytes32(0));
    }

    function testCannotSubmitOtherPlayerRun() public {
        vm.prank(player1);
        uint256 runId = registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        vm.warp(block.timestamp + 61);
        
        vm.prank(player2);
        vm.expectRevert("Unknown run");
        registry.submitScore(runId, 500, bytes32(0));
    }

    function testRevertOnZeroEntropy() public {
        vm.startPrank(player1);
        
        vm.expectRevert("Invalid BTC block hash");
        registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            bytes32(0), // Invalid BTC hash
            hemiHash,
            ethHash,
            txHash
        );
        
        vm.expectRevert("Invalid Hemi block hash");
        registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            bytes32(0), // Invalid Hemi hash
            ethHash,
            txHash
        );
        
        vm.expectRevert("Invalid ETH block hash");
        registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            bytes32(0), // Invalid ETH hash
            txHash
        );
        
        vm.expectRevert("Invalid Hemi tx hash");
        registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            bytes32(0) // Invalid tx hash
        );
        
        vm.stopPrank();
    }

    function testGameModes() public {
        vm.startPrank(player1);
        
        uint256 classicRun = registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        uint256 speedrunRun = registry.startRun(
            RunRegistry.GameMode.SPEEDRUN,
            gameVersion,
            character,
            rulesHash,
            keccak256("btc2"),
            keccak256("hemi2"),
            keccak256("eth2"),
            keccak256("tx2")
        );
        
        uint256 hardcoreRun = registry.startRun(
            RunRegistry.GameMode.HARDCORE,
            gameVersion,
            character,
            rulesHash,
            keccak256("btc3"),
            keccak256("hemi3"),
            keccak256("eth3"),
            keccak256("tx3")
        );
        
        RunRegistry.RunManifest memory classic = registry.getRunManifest(player1, classicRun);
        RunRegistry.RunManifest memory speedrun = registry.getRunManifest(player1, speedrunRun);
        RunRegistry.RunManifest memory hardcore = registry.getRunManifest(player1, hardcoreRun);
        
        assertEq(uint8(classic.gameMode), uint8(RunRegistry.GameMode.CLASSIC));
        assertEq(uint8(speedrun.gameMode), uint8(RunRegistry.GameMode.SPEEDRUN));
        assertEq(uint8(hardcore.gameMode), uint8(RunRegistry.GameMode.HARDCORE));
        
        vm.stopPrank();
    }

    function testRunStartedEvent() public {
        vm.expectEmit(true, true, false, true);
        emit RunRegistry.RunStarted(
            player1,
            0,
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        
        vm.prank(player1);
        registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
    }

    function testScoreSubmittedEvent() public {
        vm.startPrank(player1);
        uint256 runId = registry.startRun(
            RunRegistry.GameMode.CLASSIC,
            gameVersion,
            character,
            rulesHash,
            btcHash,
            hemiHash,
            ethHash,
            txHash
        );
        vm.warp(block.timestamp + 61);
        
        bytes32 actionHash = keccak256("test");
        
        vm.expectEmit(true, true, false, true);
        emit RunRegistry.ScoreSubmitted(player1, runId, 500, actionHash);
        
        registry.submitScore(runId, 500, actionHash);
        vm.stopPrank();
    }
}
