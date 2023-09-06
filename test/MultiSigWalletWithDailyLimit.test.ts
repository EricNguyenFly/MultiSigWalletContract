import { expect } from "chai";
import { ethers } from "hardhat";
import { getParamFromTxEvent, skipTime } from "./utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
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

// constants
const ONE_DAY = 24 * 3600

describe('MultiSigWalletWithDailyLimit', () => {
    const dailyLimit = 3000
    const requiredConfirmations = 2

    beforeEach(async () => {
        [owner, admin1, admin2, user1, ...accounts] = await ethers.getSigners();

        const MultiSigWalletWithDailyLimit: MultiSigWalletWithDailyLimit__factory = await ethers.getContractFactory("MultiSigWalletWithDailyLimit");
        multisigInstance = (await MultiSigWalletWithDailyLimit.deploy([admin1.address, admin2.address], requiredConfirmations, dailyLimit)) as MultiSigWalletWithDailyLimit;
        await multisigInstance.deployed();
    })

    it('create multisig', async () => {
        const deposit = 10000

        // Send money to wallet contract
        await owner.sendTransaction({
            to: multisigInstance.address,
            value: deposit
        });
        const balance = await ethers.provider.getBalance(multisigInstance.address);
        expect(balance).to.equal(deposit);
        expect(dailyLimit).to.equal(await multisigInstance.dailyLimit());
        expect(dailyLimit).to.equal(await multisigInstance.calcMaxWithdraw());

        // Withdraw daily limit
        const value1 = 2000
        let owner1Balance = await ethers.provider.getBalance(admin1.address);
        await multisigInstance.connect(admin2).submitTransaction(admin1.address, value1, []);
        expect(owner1Balance.add(value1)).to.equal(
            (await ethers.provider.getBalance(admin1.address))
        )
        expect(balance.sub(value1)).to.equal(
            (await ethers.provider.getBalance(multisigInstance.address))
        )

        // Update daily limit
        const dailyLimitUpdated = 2000
        const dailyLimitEncoded = multisigInstance.interface.encodeFunctionData("changeDailyLimit", [dailyLimitUpdated]);
        const transactionId = getParamFromTxEvent(
            await (await multisigInstance.connect(admin1).submitTransaction(multisigInstance.address, 0, dailyLimitEncoded)).wait(),
            'transactionId', null, 'Submission')

        await multisigInstance.connect(admin2).confirmTransaction(transactionId)
        expect(dailyLimitUpdated).to.equal(await multisigInstance.dailyLimit())
        expect(0).to.equal(await multisigInstance.calcMaxWithdraw())

        await skipTime(ONE_DAY + 1)
        expect(dailyLimitUpdated).to.equal(await multisigInstance.calcMaxWithdraw())

        // Withdraw daily limit
        const value2 = 1000
        owner1Balance = await ethers.provider.getBalance(admin1.address)
        await multisigInstance.connect(admin2).submitTransaction(admin1.address, value2, [])
        expect(owner1Balance.add(value2)).to.equal(
            (await ethers.provider.getBalance(admin1.address)).toString()
        )
        expect(deposit - value2 - value1).to.equal(
            await ethers.provider.getBalance(multisigInstance.address)
        )
        expect(dailyLimitUpdated - value2).to.equal(
            await multisigInstance.calcMaxWithdraw()
        )
        await multisigInstance.connect(admin2).submitTransaction(admin1.address, value2, [])
        expect(owner1Balance.add(value2 * 2)).to.equal(
            (await ethers.provider.getBalance(admin1.address)).toString()
        )
        expect(deposit - value2 * 2 - value1).to.equal(
            await ethers.provider.getBalance(multisigInstance.address)
        )
        expect(dailyLimitUpdated - value2 * 2).to.equal(
            await multisigInstance.calcMaxWithdraw()
        )

        // Third time fails, because daily limit was reached
        const transactionIdFailed = getParamFromTxEvent(
            await (await multisigInstance.connect(admin2).submitTransaction(admin1.address, value2, [])).wait(),
            'transactionId', null, 'Submission')
        expect((await multisigInstance.transactions(transactionIdFailed))[3]).to.be.false;
        expect((await ethers.provider.getBalance(admin1.address))).to.equal(
            owner1Balance.add(value2 * 2)
        )
        expect(await ethers.provider.getBalance(multisigInstance.address)).to.equal(
            deposit - value2 * 2 - value1
        )
        expect(await multisigInstance.calcMaxWithdraw()).to.equal(
            0
        )

        // Let one day pass
        await skipTime(ONE_DAY + 1)
        expect(await multisigInstance.calcMaxWithdraw()).to.equal(dailyLimitUpdated)

        // Execute transaction should work now but fails, because it is triggered from a non owner address
        await expect(multisigInstance.connect(accounts[9]).executeTransaction(transactionIdFailed)).to.revertedWith("Owner does not exist");
        // Execute transaction also fails if the sender is a wallet owner but didn't confirm the transaction first
        await expect(multisigInstance.connect(admin1).executeTransaction(transactionIdFailed)).to.revertedWith("Transaction not confirmed");
        // But it works with the right sender
        await multisigInstance.connect(admin2).executeTransaction(transactionIdFailed)

        // Let one day pass
        await skipTime(ONE_DAY + 1)
        expect(await multisigInstance.calcMaxWithdraw()).equal(
            dailyLimitUpdated
        )

        // User wants to withdraw more than the daily limit. Withdraw is unsuccessful.
        const value3 = 3000
        owner1Balance = await ethers.provider.getBalance(admin1.address)
        await multisigInstance.connect(admin2).submitTransaction(admin1.address, value3, [])

        // Wallet and user balance remain the same.
        expect(await ethers.provider.getBalance(admin1.address)).equal(
            owner1Balance
        )
        expect(await ethers.provider.getBalance(multisigInstance.address)).equal(
            deposit - value2 * 3 - value1
        )
        expect(await multisigInstance.calcMaxWithdraw()).equal(
            dailyLimitUpdated
        )

        // Daily withdraw is possible again
        await multisigInstance.connect(admin2).submitTransaction(admin1.address, value2, [])

        // Wallet balance decreases and user balance increases.
        expect(await ethers.provider.getBalance(admin1.address)).equal(
            owner1Balance.add(value2)
        )
        expect(await ethers.provider.getBalance(multisigInstance.address)).equal(
            deposit - value2 * 4 - value1
        )
        expect(await multisigInstance.calcMaxWithdraw()).equal(
            dailyLimitUpdated - value2
        )
        // Try to execute a transaction tha does not exist fails
        const unknownTransactionId = 999
        await expect(multisigInstance.connect(admin1).executeTransaction(unknownTransactionId)).to.revertedWith("Transaction not confirmed");
    })
})