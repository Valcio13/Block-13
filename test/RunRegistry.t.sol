// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/RunRegistry.sol";

contract RunRegistryTest is Test {
    RunRegistry registry;
    address player1 = address(0x1);
    address player2 = address(0x2);
    bytes32 btcHash = keccak256("btc");
    bytes32 hemiHash = keccak256("hemi");
    bytes32 ethHash = keccak256("eth");
    bytes32 txHash = keccak256("tx");
    bytes32 gameVersion = keccak256("0.2.0");
    bytes32 character = keccak256("survivor");
    bytes32 rulesHash = keccak256("classic-static-walls");
    bytes32 inputHash = keccak256("input log");
    bytes32 finalStateHash = keccak256("final state");

    function setUp() public { registry = new RunRegistry(); }

    function start(address player) internal returns (uint256) {
        vm.prank(player);
        return registry.startRun(RunRegistry.GameMode.CLASSIC, gameVersion, character, rulesHash, btcHash, hemiHash, ethHash, txHash);
    }

    function complete(address player, uint256 runId, uint32 score, uint8 outcome, uint32 tick) internal {
        vm.prank(player);
        registry.completeRun(runId, score, outcome, tick, inputHash, finalStateHash);
    }

    function testStartRunPreservesTx1Manifest() public {
        uint256 runId = start(player1);
        assertEq(runId, 0);
        RunRegistry.RunManifest memory manifest = registry.getRunManifest(player1, runId);
        assertEq(manifest.player, player1);
        assertEq(manifest.runId, runId);
        assertEq(uint8(manifest.gameMode), 0);
        assertEq(manifest.gameVersion, gameVersion);
        assertEq(manifest.character, character);
        assertEq(manifest.rulesHash, rulesHash);
        assertEq(manifest.btcBlockHash, btcHash);
        assertEq(manifest.hemiBlockHash, hemiHash);
        assertEq(manifest.ethBlockHash, ethHash);
        assertEq(manifest.hemiTxHash, txHash);
        assertEq(manifest.startedAt, block.timestamp);
    }

    function testSuccessfulCompletionStoresResultAndEmitsCanonicalEvent() public {
        uint256 runId = start(player1);
        vm.expectEmit(true, true, false, true);
        emit RunRegistry.RunCompleted(runId, player1, 500, 0, 321, inputHash, finalStateHash);
        complete(player1, runId, 500, 0, 321);
        RunRegistry.CompletedRun memory result = registry.getCompletedRun(player1, runId);
        assertTrue(result.completed);
        assertEq(result.score, 500);
        assertEq(uint8(result.outcome), 0);
        assertEq(result.terminalTick, 321);
        assertEq(result.inputHash, inputHash);
        assertEq(result.finalStateHash, finalStateHash);
        assertEq(result.completedAt, block.timestamp);
    }

    function testRejectsUnknownRunAndWrongPlayer() public {
        vm.prank(player1);
        vm.expectRevert("Unknown run");
        registry.completeRun(4, 1, 0, 1, inputHash, finalStateHash);
        uint256 runId = start(player1);
        vm.prank(player2);
        vm.expectRevert("Unknown run");
        registry.completeRun(runId, 1, 0, 1, inputHash, finalStateHash);
    }

    function testRejectsDuplicateAndInvalidOutcomes() public {
        uint256 runId = start(player1);
        complete(player1, runId, 1, 0, 1);
        vm.prank(player1);
        vm.expectRevert("Run already completed");
        registry.completeRun(runId, 1, 0, 1, inputHash, finalStateHash);
        uint256 secondRun = start(player1);
        vm.prank(player1);
        vm.expectRevert("Invalid outcome");
        registry.completeRun(secondRun, 1, 2, 1, inputHash, finalStateHash);
    }

    function testRejectsZeroHashesAndZeroTick() public {
        uint256 runId = start(player1);
        vm.startPrank(player1);
        vm.expectRevert("Invalid input hash");
        registry.completeRun(runId, 1, 0, 1, bytes32(0), finalStateHash);
        vm.expectRevert("Invalid final state hash");
        registry.completeRun(runId, 1, 0, 1, inputHash, bytes32(0));
        vm.expectRevert("Invalid terminal tick");
        registry.completeRun(runId, 1, 0, 0, inputHash, finalStateHash);
        vm.stopPrank();
    }

    function testMaxScoreAndTerminalTickAreAcceptedByProtocolWidths() public {
        uint256 runId = start(player1);
        complete(player1, runId, type(uint32).max, 1, type(uint32).max);
        RunRegistry.CompletedRun memory result = registry.getCompletedRun(player1, runId);
        assertEq(result.score, type(uint32).max);
        assertEq(result.terminalTick, type(uint32).max);
    }

    function testIndependentRunsStoreIndependentResults() public {
        uint256 first = start(player1);
        uint256 second = start(player1);
        complete(player1, first, 10, 0, 1);
        complete(player1, second, 20, 1, 2);
        assertEq(registry.getCompletedRun(player1, first).score, 10);
        assertEq(registry.getCompletedRun(player1, second).score, 20);
        assertEq(registry.nextNonce(player1), 2);
    }

    function testDifferentPlayersMayUseSameRunId() public {
        uint256 first = start(player1);
        uint256 second = start(player2);
        assertEq(first, 0);
        assertEq(second, 0);
        complete(player1, first, 11, 0, 100);
        complete(player2, second, 22, 1, 200);
        assertEq(registry.getCompletedRun(player1, first).score, 11);
        assertEq(registry.getCompletedRun(player2, second).score, 22);
    }

    function testMaximumUint256RunIdCanBeUsedOnceAndCompleted() public {
        bytes32 nonceSlot = keccak256(abi.encode(player1, uint256(0)));
        vm.store(address(registry), nonceSlot, bytes32(type(uint256).max));
        uint256 runId = start(player1);
        assertEq(runId, type(uint256).max);
        complete(player1, runId, 7, 0, 1);
        vm.prank(player1);
        vm.expectRevert("Run IDs exhausted");
        registry.startRun(RunRegistry.GameMode.CLASSIC, gameVersion, character, rulesHash, btcHash, hemiHash, ethHash, txHash);
    }

    function testRejectsZeroTx1Entropy() public {
        vm.startPrank(player1);
        vm.expectRevert("Invalid BTC block hash");
        registry.startRun(RunRegistry.GameMode.CLASSIC, gameVersion, character, rulesHash, bytes32(0), hemiHash, ethHash, txHash);
        vm.expectRevert("Invalid Hemi block hash");
        registry.startRun(RunRegistry.GameMode.CLASSIC, gameVersion, character, rulesHash, btcHash, bytes32(0), ethHash, txHash);
        vm.expectRevert("Invalid ETH block hash");
        registry.startRun(RunRegistry.GameMode.CLASSIC, gameVersion, character, rulesHash, btcHash, hemiHash, bytes32(0), txHash);
        vm.expectRevert("Invalid Hemi tx hash");
        registry.startRun(RunRegistry.GameMode.CLASSIC, gameVersion, character, rulesHash, btcHash, hemiHash, ethHash, bytes32(0));
        vm.stopPrank();
    }
}
