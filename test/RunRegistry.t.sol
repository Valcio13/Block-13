// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/RunRegistry.sol";

contract RunRegistryTest is Test {
    RunRegistry public registry;
    address public player1 = address(0x1);
    address public player2 = address(0x2);

    function setUp() public {
        registry = new RunRegistry();
    }

    function testStartRun() public {
        vm.prank(player1);
        (uint256 nonce, bytes32 seed) = registry.startRun();
        
        assertEq(nonce, 0, "First nonce should be 0");
        assertTrue(seed != bytes32(0), "Seed should not be zero");
        
        (bytes32 storedSeed, uint64 startedAt,,, bool submitted) = registry.runs(player1, nonce);
        assertEq(storedSeed, seed, "Stored seed should match");
        assertEq(startedAt, block.timestamp, "Started time should match");
        assertFalse(submitted, "Should not be submitted");
    }

    function testMultipleRuns() public {
        vm.startPrank(player1);
        
        (uint256 nonce1,) = registry.startRun();
        (uint256 nonce2,) = registry.startRun();
        
        assertEq(nonce1, 0, "First nonce should be 0");
        assertEq(nonce2, 1, "Second nonce should be 1");
        assertEq(registry.nextNonce(player1), 2, "Next nonce should be 2");
        
        vm.stopPrank();
    }

    function testDifferentPlayersSeparateNonces() public {
        vm.prank(player1);
        (uint256 nonce1,) = registry.startRun();
        
        vm.prank(player2);
        (uint256 nonce2,) = registry.startRun();
        
        assertEq(nonce1, 0, "Player 1 first nonce should be 0");
        assertEq(nonce2, 0, "Player 2 first nonce should be 0");
    }

    function testSubmitScore() public {
        vm.startPrank(player1);
        (uint256 nonce,) = registry.startRun();
        
        vm.warp(block.timestamp + 61);
        
        uint32 score = 500;
        bytes32 actionHash = keccak256(abi.encodePacked(nonce, score, block.timestamp));
        
        registry.submitScore(nonce, score, actionHash);
        
        (,, uint64 submittedAt, uint32 storedScore, bool submitted) = registry.runs(player1, nonce);
        assertTrue(submitted, "Should be marked as submitted");
        assertEq(storedScore, score, "Score should match");
        assertEq(submittedAt, block.timestamp, "Submitted time should match");
        
        vm.stopPrank();
    }

    function testCannotSubmitTooQuickly() public {
        vm.startPrank(player1);
        (uint256 nonce,) = registry.startRun();
        
        vm.warp(block.timestamp + 30);
        
        vm.expectRevert("Run too short");
        registry.submitScore(nonce, 500, bytes32(0));
        
        vm.stopPrank();
    }

    function testCannotSubmitTwice() public {
        vm.startPrank(player1);
        (uint256 nonce,) = registry.startRun();
        
        vm.warp(block.timestamp + 61);
        
        registry.submitScore(nonce, 500, bytes32(0));
        
        vm.expectRevert("Run already submitted");
        registry.submitScore(nonce, 600, bytes32(0));
        
        vm.stopPrank();
    }

    function testCannotSubmitUnknownRun() public {
        vm.prank(player1);
        vm.expectRevert("Unknown run");
        registry.submitScore(999, 500, bytes32(0));
    }

    function testCannotSubmitOtherPlayerRun() public {
        vm.prank(player1);
        (uint256 nonce,) = registry.startRun();
        
        vm.warp(block.timestamp + 61);
        
        vm.prank(player2);
        vm.expectRevert("Unknown run");
        registry.submitScore(nonce, 500, bytes32(0));
    }

    function testSeedIsDeterministic() public {
        vm.roll(100);
        vm.prevrandao(bytes32(uint256(12345)));
        
        vm.prank(player1);
        (, bytes32 seed1) = registry.startRun();
        
        vm.roll(101);
        vm.prevrandao(bytes32(uint256(67890)));
        
        vm.prank(player1);
        (, bytes32 seed2) = registry.startRun();
        
        assertTrue(seed1 != seed2, "Different blocks should produce different seeds");
    }

    function testRunStartedEvent() public {
        vm.expectEmit(true, true, false, false);
        emit RunRegistry.RunStarted(player1, 0, bytes32(0));
        
        vm.prank(player1);
        registry.startRun();
    }

    function testScoreSubmittedEvent() public {
        vm.startPrank(player1);
        (uint256 nonce,) = registry.startRun();
        vm.warp(block.timestamp + 61);
        
        bytes32 actionHash = keccak256("test");
        
        vm.expectEmit(true, true, false, true);
        emit RunRegistry.ScoreSubmitted(player1, nonce, 500, actionHash);
        
        registry.submitScore(nonce, 500, actionHash);
        vm.stopPrank();
    }
}
