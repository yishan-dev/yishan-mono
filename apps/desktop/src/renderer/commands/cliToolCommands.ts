import { getDaemonClient } from "../rpc/rpcTransport";

export type CLIToolStatus = {
  toolId: string;
  category: string;
  label: string;
  installed: boolean;
  version?: string;
  authenticated?: boolean;
  account?: string;
  statusDetail: string;
  supportsToggle?: boolean;
};

export async function listCLIToolStatuses(forceRefresh = false): Promise<CLIToolStatus[]> {
  const client = await getDaemonClient();
  return await client.cliTools.listStatuses(forceRefresh ? { refresh: true } : undefined);
}
