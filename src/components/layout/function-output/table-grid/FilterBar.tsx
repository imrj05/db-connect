import { Loader2, X, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterCondition, FilterOp } from "@/types";

const OP_LABELS: Record<FilterOp, string> = {
  "=": "equals",
  "!=": "not equals",
  ">": "greater than",
  "<": "less than",
  ">=": "greater or equal",
  "<=": "less or equal",
  "LIKE": "contains",
  "NOT LIKE": "not contains",
  "IS NULL": "is empty",
  "IS NOT NULL": "is not empty",
};

export function FilterBar({
  viewMode,
  filters,
  availableCols,
  filterLoading,
  onFilterChange,
  onRemoveFilter,
  onAddFilter,
  onApply,
}: {
  viewMode: "data" | "form" | "structure" | "er";
  filters: FilterCondition[];
  availableCols: string[];
  filterLoading: boolean;
  onFilterChange: (id: string, partial: Partial<FilterCondition>) => void;
  onRemoveFilter: (id: string) => void;
  onAddFilter: () => void;
  onApply: () => void;
}) {
  if (viewMode !== "data") return null;

  // Check if all filters have a column selected
  const allFiltersHaveColumns = filters.every((f) => f.col && f.col !== "");

  return (
    <div className="shrink-0 border-b border-border-subtle bg-surface-2/82">
      <div className="flex flex-col">
        {filters.map((f, i) => (
          <div
            key={f.id}
            className="flex items-center gap-2 px-3 py-2 hover:bg-surface-3/72 transition-colors"
          >
            {/* Join indicator for first row */}
            {i === 0 ? (
              <div className="w-10 h-8 flex items-center justify-center">
                {filters.length > 1 ? (
                  <button
                    onClick={() =>
                      onFilterChange(filters[1].id, {
                        join: filters[1].join === "AND" ? "OR" : "AND",
                      })
                    }
                    className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-1.5 rounded-[4px] bg-surface-3 text-foreground/60 hover:bg-surface-selected/82 hover:text-foreground transition-colors"
                    title="Toggle AND/OR"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-foreground/40"></span>
                )}
              </div>
            ) : (
              /* Join label for subsequent rows */
              <button
                onClick={() =>
                  onFilterChange(f.id, {
                    join: f.join === "AND" ? "OR" : "AND",
                  })
                }
                className="w-10 h-8 flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.14em] rounded-[4px] bg-surface-3 text-foreground/60 hover:bg-surface-selected/82 hover:text-foreground transition-colors"
                title="Toggle AND/OR"
              >
                {f.join}
              </button>
            )}

            {/* Column select */}
            <select
              value={f.col}
              onChange={(e) => onFilterChange(f.id, { col: e.target.value })}
              className="h-8 px-2.5 rounded-[4px] bg-surface-elevated/94 border border-border-subtle text-[12px] text-foreground outline-none min-w-[140px] flex-1 max-w-[220px]"
            >
              <option value="">Select column</option>
              {/* Include selected column even if not in availableCols to preserve selection */}
              {f.col && !availableCols.includes(f.col) && (
                <option key={f.col} value={f.col}>
                  {f.col}
                </option>
              )}
              {availableCols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Operator select */}
            <select
              value={f.op}
              onChange={(e) =>
                onFilterChange(f.id, { op: e.target.value as FilterOp })
              }
              className="h-8 px-2.5 rounded-[4px] bg-surface-elevated/94 border border-border-subtle text-[12px] text-foreground outline-none min-w-[130px] flex-1 max-w-[170px]"
            >
              {(
                [
                  "=",
                  "!=",
                  ">",
                  "<",
                  ">=",
                  "<=",
                  "LIKE",
                  "NOT LIKE",
                  "IS NULL",
                  "IS NOT NULL",
                ] as FilterOp[]
              ).map((op) => (
                <option key={op} value={op}>
                  {OP_LABELS[op]}
                </option>
              ))}
            </select>

            {/* Value input */}
            {f.op !== "IS NULL" && f.op !== "IS NOT NULL" ? (
              <Input
                value={f.value}
                onChange={(e) =>
                  onFilterChange(f.id, { value: e.target.value })
                }
                onKeyDown={(e) => e.key === "Enter" && onApply()}
                placeholder="Enter value"
                className="h-8 text-[12px] flex-[2] min-w-[170px] bg-surface-elevated/94 focus-visible:ring-0"
              />
            ) : (
              <div className="h-8 flex-[2] min-w-[170px] flex items-center text-[12px] text-foreground/52 italic px-2.5">
                No value needed
              </div>
            )}

            {/* Action buttons - only on first row */}
            {i === 0 ? (
              <div className="flex items-center gap-1 shrink-0">
                {filters.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onRemoveFilter(f.id)}
                  className="h-8 w-8 text-foreground/56 hover:text-destructive hover:bg-destructive/10"
                  >
                    <X size={14} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onAddFilter}
                  className="h-8 w-8 text-foreground/56 hover:text-foreground hover:bg-surface-3"
                >
                  <Plus size={14} />
                </Button>
                <Button
                  size="sm"
                  onClick={onApply}
                  disabled={filterLoading || filters.length === 0 || !allFiltersHaveColumns}
                  className="h-8 px-3 bg-primary hover:bg-primary/92 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed gap-1.5 text-[11px] font-medium rounded-[4px] shadow-xs"
                >
                  {filterLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  Apply
                </Button>
              </div>
            ) : (
              /* Remove button for other rows */
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onRemoveFilter(f.id)}
                  className="h-8 w-8 text-foreground/56 hover:text-destructive hover:bg-destructive/10"
                >
                  <X size={14} />
                </Button>
                <div className="w-14" /> {/* Spacer to align with first row */}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
