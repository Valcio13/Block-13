// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/RunRegistry.sol";

contract DeployScript is Script {
    function run() public {
        vm.startBroadcast();
        
        RunRegistry registry = new RunRegistry();
        console.log("RunRegistry deployed to:", address(registry));
        
        vm.stopBroadcast();
    }
}
