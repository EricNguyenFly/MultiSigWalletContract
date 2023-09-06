import hre from "hardhat";
import fs from "fs";
import {
	MultiSigWalletFactory__factory,
	MultiSigWalletFactory,
} from "../typechain-types";

async function main() {
	//* Loading accounts */
	const accounts = await hre.ethers.getSigners();

	console.log('=====================================================================================');
	console.log('ACCOUNTS:');
	console.log('=====================================================================================');
	for (let i = 0; i < accounts.length; i++) {
		const account = accounts[i];
		console.log(` Account ${i}: ${account.address}`);
	}

	//* Loading contract factory */
	const MultiSigWalletFactory: MultiSigWalletFactory__factory = await hre.ethers.getContractFactory("MultiSigWalletFactory");
	//* Deploy contracts */
	console.log("================================================================================");
	console.log("DEPLOYING CONTRACTS");
	console.log("================================================================================");

	const multiSigWalletFactory = await MultiSigWalletFactory.deploy() as MultiSigWalletFactory;
	await multiSigWalletFactory.deployed();
	console.log("MultiSigWalletFactory                          deployed to:>>", multiSigWalletFactory.address);

	console.log("================================================================================");
	console.log("DONE");
	console.log("================================================================================");

	const contracts = {
		multiSigWalletFactory: multiSigWalletFactory.address,
	};

	await fs.writeFileSync("contracts.json", JSON.stringify(contracts));

	const contractVerify = {
		multiSigWalletFactory: multiSigWalletFactory.address,
	};

	await fs.writeFileSync("contracts-verify.json", JSON.stringify(contractVerify));

	await hre
		.run("verify:verify", {
			address: multiSigWalletFactory.address,
		})
		.catch(console.log);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
