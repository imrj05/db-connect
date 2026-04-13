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
    <div className="shrink-0 border-b border-border bg-card">
      <div className="flex flex-col">
        {filters.map((f, i) => (
          <div
            key={f.id}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors"
          >
            {/* Join indicator for first row */}
            {i === 0 ? (
              <div className="w-8 h-7 flex items-center justify-center">
                {filters.length > 1 ? (
                  <button
                    onClick={() =>
                      onFilterChange(filters[1].id, {
                        join: filters[1].join === "AND" ? "OR" : "AND",
                      })
                    }
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-muted hover:bg-muted-foreground/20 text-muted-foreground transition-colors"
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
                  <span className="text-[10px] font-mono text-muted-foreground/50"></span>
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
                className="w-8 h-7 flex items-center justify-center text-[10px] font-mono font-bold uppercase tracking-wider rounded-md bg-muted hover:bg-muted-foreground/20 text-muted-foreground transition-colors"
                title="Toggle AND/OR"
              >
                {f.join}
              </button>
            )}

            {/* Column select */}
            <select
              value={f.col}
              onChange={(e) => onFilterChange(f.id, { col: e.target.value })}
              className="h-7 px-2.5 rounded-md bg-background border border-input text-[12px] text-foreground outline-none min-w-[120px] flex-1 max-w-[200px]"
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
              className="h-7 px-2.5 rounded-md bg-background border border-input text-[12px] text-foreground outline-none min-w-[120px] flex-1 max-w-[160px]"
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
                className="h-7 text-[12px] flex-[2] min-w-[150px] bg-background focus-visible:ring-0"
              />
            ) : (
              <div className="h-7 flex-[2] min-w-[150px] flex items-center text-[12px] text-muted-foreground italic px-2.5">
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
                    className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                  >
                    <X size={14} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onAddFilter}
                  className="h-7 w-7 text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                >
                  <Plus size={14} />
                </Button>
                <Button
                  size="icon-xs"
                  onClick={onApply}
                  disabled={filterLoading || filters.length === 0 || !allFiltersHaveColumns}
                  className="h-7 w-7 bg-accent-blue hover:bg-accent-blue/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {filterLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                </Button>
              </div>
            ) : (
              /* Remove button for other rows */
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onRemoveFilter(f.id)}
                  className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
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
