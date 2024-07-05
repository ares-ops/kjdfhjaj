# Environment

### Install required modules

`yarn install or npm install`

### Please create prkey.ts file and input private key.

`export const PRIVATE_KEY = "xxxyyyzzz";`

### Switch the network using flag variable in config.ts

`const isMainnet = false;`

# Deploy token

### Save token logo image in assets/ folder.

### Update token information in `config.ts` file

`export const TOKEN_IMG_NAME = "token-logo.png";`
`export const TOKEN_NAME = "token_name";`
`export const TOKEN_SYMBOL = "token_symbol";`
`export const TOKEN_DESCRIPTION = "token_description";`
`export const TOKEN_DECIMAL = 9;`
`export const INIT_FEE_PERCENTAGE = 300; // 3%`
`export const MAX_FEE = 1_000; // 1000 tokens`
`export const MINT_AMOUNT = 1_000_000; // 1,000,000 tokens`

### Run the command like this

`ts-node index.ts Deploy`

### Save the token address in `config.ts` file

Please copy the token address (aaabbbccc) in log `Token address: aaabbbccc`

And save it in `config.ts` file

`export const TOKEN_MINT = new PublicKey("aaabbbccc");`

# Withdraw Fee tokens

### Update withdraw period in `config.ts` file

`export const WITHDRAW_PERIOD = 100; // in seconds`

### Check the token address in `config.ts` file

`export const TOKEN_MINT = new PublicKey("aaabbbccc");`

### Run the command like this

`ts-node withdraw.ts`
