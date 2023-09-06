// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "./Factory.sol";
import "./MultiSigWallet.sol";


/// @title Multisignature wallet factory - Allows creation of multisig wallet.
contract MultiSigWalletFactory is Factory {

    /*
     * Public functions
     */
    /// @dev Allows verified creation of multisignature wallet.
    /// @param _owners List of initial owners.
    /// @param _required Number of required confirmations.
    /// @return wallet wallet address.
    function create(address[] memory _owners, uint _required)
        public
        returns (address)
    {
        MultiSigWallet wallet = new MultiSigWallet(_owners, _required);
        register(address(wallet));
        return address(wallet);
    }
}
