import { TableDropdownMenu } from "./TableDropdownMenu";
import { LuX } from "react-icons/lu";

const PORTS_GRID_TEMPLATE_COLUMNS = "minmax(0, 1.2fr) minmax(0, 0.6fr) minmax(0, 0.8fr)";

export type PortsTableMenuRow = {
  id: string;
  addressPortLabel: string;
  pidLabel: string;
  processNameLabel: string;
  addressPortTooltip?: string;
};

type PortsTableMenuProps = {
  anchorEl: HTMLElement | null;
  rows: PortsTableMenuRow[];
  summaryLabel: string;
  toggleAriaLabel: string;
  addressPortColumnLabel: string;
  pidColumnLabel: string;
  processNameColumnLabel: string;
  onClose: () => void;
  onOpen: (anchorEl: HTMLElement) => void;
  onSelectRow: (rowId: string) => void;
  onCloseRow: (rowId: string) => void;
  isClosingRow?: (rowId: string) => boolean;
};

/** Renders one stateless ports button and table-like dropdown with address:port, pid, and process columns. */
export function PortsTableMenu({
  anchorEl,
  rows,
  summaryLabel,
  toggleAriaLabel,
  addressPortColumnLabel,
  pidColumnLabel,
  processNameColumnLabel,
  onClose,
  onOpen,
  onSelectRow,
  onCloseRow,
  isClosingRow,
}: PortsTableMenuProps) {
  return (
    <TableDropdownMenu
      anchorEl={anchorEl}
      rows={rows.map((row) => ({
        id: row.id,
        cells: [
          {
            label: row.addressPortLabel,
            mono: true,
            noWrap: true,
            title: row.addressPortTooltip,
          },
          {
            label: row.pidLabel,
            mono: true,
            align: "right",
          },
          {
            label: row.processNameLabel,
            align: "right",
            noWrap: true,
          },
        ],
      }))}
      columns={[
        { label: addressPortColumnLabel },
        { label: pidColumnLabel, align: "right" },
        { label: processNameColumnLabel, align: "right" },
      ]}
      summaryLabel={summaryLabel}
      toggleAriaLabel={toggleAriaLabel}
      gridTemplateColumns={PORTS_GRID_TEMPLATE_COLUMNS}
      paperMinWidth={240}
      onOpen={onOpen}
      onClose={onClose}
      onSelectRow={onSelectRow}
      getRowAction={(rowId) => ({
        ariaLabel: `Close port ${rows.find((row) => row.id === rowId)?.addressPortLabel ?? ""}`,
        icon: <LuX size={12} />,
        onClick: onCloseRow,
        disabled: isClosingRow?.(rowId) ?? false,
      })}
    />
  );
}
