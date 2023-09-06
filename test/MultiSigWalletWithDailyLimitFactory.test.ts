import { expect } from "chai";
import { ethers } from "hardhat";
import {getParamFromTxEvent } from "./utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    MultiSigWalletWithDailyLimitFactory__factory,
    MultiSigWalletWithDailyLimitFactory,
    MultiSigWalletWithDailyLimit__factory
} from "../typechain-types";

// signer variables
let owner: SignerWithAddress;
let admin1: SignerWithAddress;
let admin2: SignerWithAddress;
let user1: SignerWithAddress;
let accounts: SignerWithAddress[];

// contract instance
let factoryInstance: MultiSigWalletWithDailyLimitFactory;

describe('MultiSigWalletWithDailyLimitFactory', () => {
    const dailyLimit = 3000
    const requiredConfirmations = 2

    beforeEach(async () => {
        [owner, admin1, admin2, user1, ...accounts] = await ethers.getSigners();

        const MultiSigWalletWithDailyLimitFactory: MultiSigWalletWithDailyLimitFactory__factory = await ethers.getContractFactory("MultiSigWalletWithDailyLimitFactory");
        factoryInstance = (await MultiSigWalletWithDailyLimitFactory.deploy()) as MultiSigWalletWithDailyLimitFactory;
        await factoryInstance.deployed();
    })

    it('Multisig Factory', async () => {
        // Create factory
        const tx = await factoryInstance.create([admin1.address, admin2.address], requiredConfirmations, dailyLimit)
        const walletAddress = getParamFromTxEvent(await tx.wait(), 'instantiation', null, 'ContractInstantiation')

        const walletCount = await factoryInstance.getInstantiationCount(owner.address)
        const multisigWalletAddressConfirmation = await factoryInstance.instantiations(owner.address, walletCount.sub(1).toNumber())
        expect(multisigWalletAddressConfirmation).to.equal(walletAddress);
        expect(await factoryInstance.isInstantiation(walletAddress)).to.be.true;

        // Send money to wallet contract
        const MultiSigWalletWithDailyLimit: MultiSigWalletWithDailyLimit__factory = await ethers.getContractFactory("MultiSigWalletWithDailyLimit");
        const multisigInstance = await MultiSigWalletWithDailyLimit.attach(walletAddress)
        const deposit = 10000
        await admin1.sendTransaction({
            to: walletAddress,
            value: deposit
        });
        const balance = await ethers.provider.getBalance(walletAddress)
        expect(balance).to.equal(deposit)
        expect(await multisigInstance.dailyLimit()).to.equal(dailyLimit)
        expect(await multisigInstance.calcMaxWithdraw()).to.equal(dailyLimit)

        // Update daily limit
        const dailyLimitUpdated = 2000
        const dailyLimitEncoded = multisigInstance.interface.encodeFunctionData("changeDailyLimit", [dailyLimitUpdated])
        const transactionId = getParamFromTxEvent(
            await (await multisigInstance.connect(admin1).submitTransaction(multisigInstance.address, 0, dailyLimitEncoded)).wait(),
            'transactionId', null, 'Submission'
        )

        await multisigInstance.connect(admin2).confirmTransaction(transactionId)
        expect(await multisigInstance.dailyLimit()).to.equal(dailyLimitUpdated)
        expect(await multisigInstance.calcMaxWithdraw()).to.equal(dailyLimitUpdated)
    })
})