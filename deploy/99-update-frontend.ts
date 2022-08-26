import { ethers, network } from "hardhat";
import fs from "fs";
const FRONTEND_ADDRESSES_FILE = "../nextjs-smartcontract-lottery/constants/contractAddresses.json";
const FRONTEND_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json";

const updateFrontend = () => {
	if (process.env.UPDATE_FRONT_END) {
		console.log("Updating Frontend");
		updateContractAdresses();
		console.log("Contract Addess Created");
		updateContractAbi();
		console.log("Contract ABI Created");
	}
};

const updateContractAdresses = async () => {
	const raffle = await ethers.getContract("Raffle");
	const contractAddresses = JSON.parse(fs.readFileSync(FRONTEND_ADDRESSES_FILE, "utf8"));
	const chainId = network.config.chainId?.toString();

	if (chainId) {
		if (contractAddresses.chainId && !contractAddresses.chainId.includes(raffle.address)) {
			contractAddresses[chainId].push(raffle.address);
		} else {
			contractAddresses[chainId] = [raffle.address];
		}
	}
	fs.writeFileSync(FRONTEND_ADDRESSES_FILE, JSON.stringify(contractAddresses));
};
const updateContractAbi = async () => {
	const raffle = await ethers.getContract("Raffle");
	const abi = raffle.interface.format(ethers.utils.FormatTypes.json);

	fs.writeFileSync(FRONTEND_ABI_FILE, abi as string);
};

export default updateFrontend;
updateFrontend.tags = ["all", "frontend"];
