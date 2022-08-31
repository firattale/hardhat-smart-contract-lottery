import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "hardhat-gas-reporter";
import "dotenv/config";
import "solidity-coverage";
import "hardhat-deploy";
import { HardhatUserConfig } from "hardhat/config";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const RINKEBY_RPC_URL = process.env.RINKEBY_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const COINMARKET_API_KEY = process.env.COINMARKET_API_KEY || "";

const config: HardhatUserConfig = {
	solidity: "0.8.9",
	defaultNetwork: "hardhat",
	networks: {
		hardhat: {
			chainId: 31337,
		},
		rinkeby: {
			chainId: 4,
			url: RINKEBY_RPC_URL,
			accounts: [PRIVATE_KEY],
		},
	},
	namedAccounts: {
		deployer: { default: 0 },
		player: { default: 1 },
	},
	gasReporter: {
		enabled: true,
		currency: "USD",
		outputFile: "gas-report.txt",
		noColors: true,
		coinmarketcap: process.env.COINMARKETCAP_API_KEY,
	},
	mocha: {
		timeout: 500000,
	},
	etherscan: {
		// yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
		apiKey: {
			rinkeby: ETHERSCAN_API_KEY,
		},
	},
};
export default config;

// https://rinkeby.etherscan.io/address/0xD724c7520186f61b4E98994bbcE15b276861AD9D#code
