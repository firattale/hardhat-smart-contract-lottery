import { network, ethers } from "hardhat";
import { developmentChains } from "../helper-hardhat-config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const BASE_FEE = ethers.utils.parseEther("0.25");
const GAS_PRICE_LINK = 1e9;

const deployMocks = async function ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) {
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();
	if (developmentChains.includes(network.name)) {
		log("Localhost chain detected, deploying mocks");
		await deploy("VRFCoordinatorV2Mock", {
			from: deployer,
			log: true,
			args: [BASE_FEE, GAS_PRICE_LINK],
		});
		log("Mocks deployed");
		log("----------------------------------------");
	}
};
export default deployMocks;
deployMocks.tags = ["all", "mocks"];
