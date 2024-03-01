import neynarClient from "@/clients/neynar";
import getSvg from "@/utils/_svg";
import { OpSepoliaTestnet } from "@thirdweb-dev/chains";
import { Engine } from "@thirdweb-dev/engine";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();

  const { TW_ENGINE_URL, TW_ACCESS_TOKEN, TW_BACKEND_WALLET } = process.env;

  try {
    if (!TW_ENGINE_URL || !TW_ACCESS_TOKEN || !TW_BACKEND_WALLET) {
      throw new Error("Missing environment variables");
    }

    const thirdwebSDK = new ThirdwebSDK(OpSepoliaTestnet, {
      secretKey: process.env.TW_SECRET_KEY,
    });

    const { hash, address } = body;

    if (!hash || !address) {
      throw new Error("Missing hash or address");
    }

    const {
      result: { cast },
    } = await neynarClient.lookUpCastByHash(hash);

    const { result: author } = await neynarClient.lookupUserByFid(
      Number(cast.author.fid)
    );

    const svg = getSvg(
      String(cast.text),
      String(author.user.displayName),
      String(author.user.pfp.url)
    );

    const ipfs = await thirdwebSDK.storage.upload(svg);

    const engine = new Engine({
      url: TW_ENGINE_URL,
      accessToken: TW_ACCESS_TOKEN,
    });

    const { result } = await engine.erc1155.mintTo(
      OpSepoliaTestnet.chainId.toString(),
      process.env.NFT_CONTRACT_ADDRESS!,
      process.env.TW_BACKEND_WALLET!,
      {
        receiver: address,
        metadataWithSupply: {
          metadata: {
            name: "Mintcaster",
            description: "Mintcaster",
            image: ipfs,
            external_url: `https://mintcaster.vercel.app/cast/${hash}`,
            // @ts-ignore
            attributes: [
              {
                trait_type: "Type",
                value: "Mintcaster",
              },
              {
                trait_type: "Author",
                value: cast.author.fid,
              },
              {
                trait_type: "Hash",
                value: hash,
              },
            ],
          },
          supply: "1",
        },
      }
    );

    return NextResponse.json(
      { message: "Minted successfully", result },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: "Something went wrong: " + error },
      { status: 500 }
    );
  }
}
