import { network, ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { developmentChains, networkConfig, VERIFICATION_BLOCK_CONFIRMATIONS } from "../helper-hardhat-config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import verify from "../utils/verify";
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2");

const deployMocks: DeployFunction = async function ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) {
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();
	const chainId = network.config.chainId;
	let vrfCoordinatorV2Address, subscriptionId;

	if (developmentChains.includes(network.name)) {
		const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
		vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
		const txResponse = await vrfCoordinatorV2Mock.createSubscription();
		const txReceipt = await txResponse.wait(1);
		subscriptionId = txReceipt.events[0].args.subId;
		// Fund the subscription
		// Usually, you'd need the link token on a real network
		await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
	} else {
		vrfCoordinatorV2Address = networkConfig[chainId!].vrfCoordinatorV2;
		subscriptionId = networkConfig[chainId!].subscriptionId;
	}
	const { entranceFee, gasLane, callbackGasLimit, interval } = networkConfig[chainId!];
	const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval];
	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;

	const raffle = await deploy("Raffle", {
		from: deployer,
		args,
		log: true,
		waitConfirmations: waitBlockConfirmations,
	});
	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		log("Verifying contract...");
		await verify(raffle.address, args);
	}
	log("----------------------------------------");
};

export default deployMocks;
deployMocks.tags = ["all", "mocks"];
// 1. Get our SubId for Chainlink VRF and Fund
// 2. Deploy our contract with using the SubId
// 3. Register the contract with Chainlink VRF and its subId
// 4. Register the contract with Chainlink Keepers
// 5  Run the staging tests
