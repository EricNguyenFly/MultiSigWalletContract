import { expect } from "chai";
import { ethers } from "hardhat";
import { getParamFromTxEvent } from "./utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    TestToken__factory,
    TestToken,
    MultiSigWalletWithDailyLimit__factory,
    MultiSigWalletWithDailyLimit
} from "../typechain-types";

// signer variables
let owner: SignerWithAddress;
let admin1: SignerWithAddress;
let admin2: SignerWithAddress;
let user1: SignerWithAddress;
let accounts: SignerWithAddress[];

// contract instance
let multisigInstance: MultiSigWalletWithDailyLimit;
let tokenInstance: TestToken;

describe('ExternalCallsWithDailyLimit', () => {
    const dailyLimit = 3000
    const requiredConfirmations = 2

    beforeEach(async () => {
        [owner, admin1, admin2, user1, ...accounts] = await ethers.getSigners();

        const MultiSigWalletWithDailyLimit: MultiSigWalletWithDailyLimit__factory = await ethers.getContractFactory("MultiSigWalletWithDailyLimit");
        multisigInstance = (await MultiSigWalletWithDailyLimit.deploy([admin1.address, admin2.address], requiredConfirmations, dailyLimit)) as MultiSigWalletWithDailyLimit;
        await multisigInstance.deployed();

        const TestToken: TestToken__factory = await ethers.getContractFactory("TestToken");
        tokenInstance = (await TestToken.deploy()) as TestToken;
        await tokenInstance.deployed();

        const deposit = 10000000

        // Send money to wallet contract
        await owner.sendTransaction({
            to: multisigInstance.address,
            value: deposit
        });

        const balance = await ethers.provider.getBalance(multisigInstance.address)
        expect(balance).to.equal(deposit)
    })

    it('transferWithPayloadSizeCheck', async () => {
        // Issue tokens to the multisig address
        await tokenInstance.connect(admin1).issueTokens(multisigInstance.address, 1000000)
        // Encode transfer call for the multisig
        const transferEncoded = tokenInstance.interface.encodeFunctionData("transfer", [admin2.address, 1000000])
        const transactionId = getParamFromTxEvent(
            await (await multisigInstance.connect(admin1).submitTransaction(tokenInstance.address, 0, transferEncoded)).wait(),
            'transactionId', null, 'Submission')

        const executedTransactionId = getParamFromTxEvent(
            await (await multisigInstance.connect(admin2).confirmTransaction(transactionId)).wait(),
            'transactionId', null, 'Execution')
        // Check that transaction has been executed
        expect(transactionId).to.equal(executedTransactionId)
        // Check that the transfer has actually occured
        expect(await tokenInstance.balanceOf(admin2.address)).equal(1000000)
    })
})
