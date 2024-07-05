import { errorFromCode } from "@metaplex-foundation/mpl-candy-guard";

/** Returns an error message from a transaction error message */
export function fromTxError(err) {
  const match = /custom program error: (\w+)/.exec(err + "");

  if (match === null) {
    return null;
  }

  const [codeRaw] = match.slice(1);

  let errorCode;
  try {
    errorCode = parseInt(codeRaw, 16);
  } catch (parseErr) {
    return null;
  }

  return errorFromCode(errorCode);
}
