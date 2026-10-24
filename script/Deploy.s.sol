// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/RunRegistry.sol";

contract DeployScript is Script {
    function run() public {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        require(block.chainid == expectedChainId, "Unexpected chain ID; deployment target does not match EXPECTED_CHAIN_ID");
        vm.startBroadcast();
        
        RunRegistry registry = new RunRegistry();
        console.log("RunRegistry deployed to:", address(registry));
        
        vm.stopBroadcast();
    }
}
