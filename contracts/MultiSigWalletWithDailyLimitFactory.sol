// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "./Factory.sol";
import "./MultiSigWalletWithDailyLimit.sol";


/// @title Multisignature wallet factory for daily limit version - Allows creation of multisig wallet.
contract MultiSigWalletWithDailyLimitFactory is Factory {

    /*
     * Public functions
     */
    /// @dev Allows verified creation of multisignature wallet.
    /// @param _owners List of initial owners.
    /// @param _required Number of required confirmations.
    /// @param _dailyLimit Amount in wei, which can be withdrawn without confirmations on a daily basis.
    /// @return wallet wallet address.
    function create(address[] memory _owners, uint _required, uint _dailyLimit)
        public
        returns (address)
    {
        MultiSigWalletWithDailyLimit wallet = new MultiSigWalletWithDailyLimit(_owners, _required, _dailyLimit);
        register(address(wallet));
        return address(wallet);
    }
}
