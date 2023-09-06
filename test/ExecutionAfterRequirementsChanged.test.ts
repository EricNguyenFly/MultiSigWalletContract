import { expect } from "chai";
import { ethers } from "hardhat";
import { getParamFromTxEvent } from "./utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    MultiSigWallet__factory,
    MultiSigWallet
} from "../typechain-types";

// signer variables
let owner: SignerWithAddress;
let admin1: SignerWithAddress;
let admin2: SignerWithAddress;
let user1: SignerWithAddress;
let accounts: SignerWithAddress[];

// contract instance
let multisigInstance: MultiSigWallet;

describe('MultiSigWallet', () => {
    const requiredConfirmations = 2

    beforeEach(async () => {
        [owner, admin1, admin2, user1, ...accounts] = await ethers.getSigners();

        const MultiSigWallet: MultiSigWallet__factory = await ethers.getContractFactory("MultiSigWallet");
        multisigInstance = (await MultiSigWallet.deploy([owner.address, admin1.address, admin2.address], requiredConfirmations)) as MultiSigWallet;
        await multisigInstance.deployed();
    })

    it('test execution after requirements changed', async () => {
        const deposit = 1000

        // Send money to wallet contract
        await owner.sendTransaction({
            to: multisigInstance.address,
            value: deposit
        });

        const balance = await ethers.provider.getBalance(multisigInstance.address)
        expect(balance).to.equal(deposit)

        // Add owner wa_4
        const addOwnerData = multisigInstance.interface.encodeFunctionData("addOwner", [accounts[3].address])
        const transactionId = getParamFromTxEvent(
            await (await multisigInstance.connect(owner).submitTransaction(multisigInstance.address, 0, addOwnerData)).wait(),
            'transactionId',
            null,
            'Submission'
        )

        // There is one pending transaction
        const excludePending = false
        const includePending = true
        const excludeExecuted = false
        const includeExecuted = true
        expect(await multisigInstance.getTransactionIds(0, 1, includePending, excludeExecuted)).to.deep.equal(
            [transactionId]
        )

        // Update required to 1
        const newRequired = 1
        const updateRequirementData = multisigInstance.interface.encodeFunctionData("changeRequirement", [newRequired])

        // Submit successfully
        const transactionId2 = getParamFromTxEvent(
            await (await multisigInstance.connect(owner).submitTransaction(multisigInstance.address, 0, updateRequirementData)).wait(),
            'transactionId',
            null,
            'Submission'
        )

        expect(await multisigInstance.getTransactionIds(0, 2, includePending, excludeExecuted)).to.deep.equal([transactionId, transactionId2])

        // Confirm change requirement transaction
        await multisigInstance.connect(admin1).confirmTransaction(transactionId2)
        expect(await multisigInstance.required()).to.equal(newRequired)
        expect(await multisigInstance.getTransactionIds(0, 1, excludePending, includeExecuted)).to.deep.equal([transactionId2])

        // Execution fails, because sender is not wallet owner

        await expect(multisigInstance.connect(accounts[9]).executeTransaction(transactionId)).to.revertedWith("Owner does not exist")

        // Because the # required confirmations changed to 1, the addOwner transaction can be executed now
        await multisigInstance.connect(owner).executeTransaction(transactionId)
        expect(await multisigInstance.getTransactionIds(0, 2, excludePending, includeExecuted)).to.deep.equal([transactionId, transactionId2])
    })

    it('test execution after remove owner', async () => {
        const deposit = 1000

        // Send money to wallet contract
        await owner.sendTransaction({
            to: multisigInstance.address,
            value: deposit
        });

        const balance = await ethers.provider.getBalance(multisigInstance.address)
        expect(balance).to.equal(deposit)

        // Add owner wa_4
        const removeOwnerData = multisigInstance.interface.encodeFunctionData("removeOwner", [admin2.address])
        const transactionId = getParamFromTxEvent(
            await (await multisigInstance.connect(owner).submitTransaction(multisigInstance.address, 0, removeOwnerData)).wait(),
            'transactionId',
            null,
            'Submission'
        )

        await multisigInstance.connect(admin2).confirmTransaction(transactionId)
        await expect(multisigInstance.connect(admin2).executeTransaction(transactionId)).to.revertedWith("Owner does not exist");
        await expect(multisigInstance.connect(owner).executeTransaction(transactionId)).to.revertedWith("Transaction already executed");

        expect(await multisigInstance.getOwners()).to.deep.equal([owner.address, admin1.address])
    })
})