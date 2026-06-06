export interface Medicine {
    id: string;
    brand_name: string | null;
    generic_name: string;
    composition: string | null;
    manufacturer: string;
    mrp?: number | null;
    jan_aushadhi_price?: number | null;
    expiry_date?: string | null;
    medicine_type?: "brand" | "generic";
    cdsco_approval_status: string;
}

export interface ComparisonGridLabels {
    emptyComparison: string;
    fieldHeader: string;
    medicineA: string;
    medicineB: string;
    priceUnavailable: string;
    noSavings: string;
    saveAmount: (amount: string, percent: string) => string;
    directSavings: (cheaper: string, expensive: string, amount: string, percent: string) => string;
    rows: {
        brandName: string;
        genericName: string;
        composition: string;
        manufacturer: string;
        type: string;
        cdscoStatus: string;
        expiryDate: string;
        marketPrice: string;
        janAushadhiPrice: string;
        savings: string;
    };
    medicineTypes: {
        brand: string;
        generic: string;
    };
    status: {
        approved: string;
        recalled: string;
        banned: string;
    };
}

const defaultLabels: ComparisonGridLabels = {
    emptyComparison: "Select two medicines above to see the comparison.",
    fieldHeader: "Field",
    medicineA: "Medicine A",
    medicineB: "Medicine B",
    priceUnavailable: "Price unavailable",
    noSavings: "No savings",
    saveAmount: (amount, percent) => `Save ₹${amount} (${percent}%)`,
    directSavings: (cheaper, expensive, amount, percent) =>
        `By choosing ${cheaper} instead of ${expensive}, you save ₹${amount} (${percent}%).`,
    rows: {
        brandName: "Brand name",
        genericName: "Generic name",
        composition: "Composition",
        manufacturer: "Manufacturer",
        type: "Type",
        cdscoStatus: "CDSCO status",
        expiryDate: "Expiry date",
        marketPrice: "Market price (MRP)",
        janAushadhiPrice: "Jan Aushadhi price",
        savings: "Savings vs MRP",
    },
    medicineTypes: {
        brand: "brand",
        generic: "generic",
    },
    status: {
        approved: "Approved",
        recalled: "Recalled",
        banned: "Banned",
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasValidMrp(m: Medicine | null | undefined): m is Medicine & { mrp: number } {
    return m != null && m.mrp != null && Number.isFinite(m.mrp) && m.mrp >= 0;
}

function hasValidJanAushadhiPrice(
    m: Medicine | null | undefined
): m is Medicine & { jan_aushadhi_price: number } {
    return (
        m != null &&
        m.jan_aushadhi_price != null &&
        Number.isFinite(m.jan_aushadhi_price) &&
        m.jan_aushadhi_price >= 0
    );
}

function formatExpiry(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function displayName(m: Medicine): string {
    return m.brand_name?.trim() || m.generic_name;
}

function formatStatus(status: string, labels: ComparisonGridLabels): string {
    const map: Record<string, string> = {
        approved: labels.status.approved,
        recalled: labels.status.recalled,
        banned: labels.status.banned,
    };
    return map[status.toLowerCase()] ?? status;
}

function computeSavingsPercent(higher: number, lower: number): number {
    if (higher <= 0) return 0;
    return ((higher - lower) / higher) * 100;
}

function formatPrice(value: number | null | undefined, unavailableText: string): string {
    return value != null ? `₹${value.toFixed(2)}` : unavailableText;
}

function getSavingsText(medicine: Medicine | null, labels: ComparisonGridLabels): string {
    if (!medicine || !hasValidMrp(medicine) || !hasValidJanAushadhiPrice(medicine)) {
        return labels.priceUnavailable;
    }
    if (medicine.mrp <= medicine.jan_aushadhi_price) {
        return labels.noSavings;
    }
    const amount = medicine.mrp - medicine.jan_aushadhi_price;
    const percent = computeSavingsPercent(medicine.mrp, medicine.jan_aushadhi_price);
    return labels.saveAmount(amount.toFixed(2), percent.toFixed(1));
}

// ── Direct savings between two medicines ──────────────────────────────────────

interface DirectSavingsResult {
    hasSavings: boolean;
    cheaperName: string;
    expensiveName: string;
    absoluteSaving: number;
    percentSaving: number;
    summaryText: string;
}

function computeDirectSavings(
    m1: Medicine | null,
    m2: Medicine | null,
    labels: ComparisonGridLabels
): DirectSavingsResult | null {
    // Get the best available price for each medicine:
    // prefer Jan Aushadhi price, fall back to MRP
    const getPrice = (m: Medicine | null): number | null => {
        if (!m) return null;
        if (hasValidJanAushadhiPrice(m)) return m.jan_aushadhi_price;
        if (hasValidMrp(m)) return m.mrp;
        return null;
    };

    const price1 = getPrice(m1);
    const price2 = getPrice(m2);

    if (price1 === null || price2 === null || !m1 || !m2) return null;
    if (price1 === price2) return null;

    const [cheaper, expensive, cheaperPrice, expensivePrice] =
        price1 < price2
            ? [m1, m2, price1, price2]
            : [m2, m1, price2, price1];

    const absoluteSaving = expensivePrice - cheaperPrice;
    const percentSaving = computeSavingsPercent(expensivePrice, cheaperPrice);

    return {
        hasSavings: true,
        cheaperName: displayName(cheaper),
        expensiveName: displayName(expensive),
        absoluteSaving,
        percentSaving,
        summaryText: labels.directSavings(
            displayName(cheaper),
            displayName(expensive),
            absoluteSaving.toFixed(2),
            percentSaving.toFixed(1)
        ),
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComparisonGrid({
    medicine1,
    medicine2,
    labels = defaultLabels,
}: {
    medicine1: Medicine | null;
    medicine2: Medicine | null;
    labels?: ComparisonGridLabels;
}) {
    if (!medicine1 && !medicine2) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center text-slate-500">
                {labels.emptyComparison}
            </div>
        );
    }

    const rows: { label: string; getValue: (m: Medicine) => string }[] = [
        { label: labels.rows.brandName, getValue: (m) => m.brand_name?.trim() || "—" },
        { label: labels.rows.genericName, getValue: (m) => m.generic_name },
        { label: labels.rows.composition, getValue: (m) => m.composition?.trim() || "—" },
        { label: labels.rows.manufacturer, getValue: (m) => m.manufacturer },
        {
            label: labels.rows.type,
            getValue: (m) =>
                m.medicine_type ??
                (m.brand_name?.trim() ? labels.medicineTypes.brand : labels.medicineTypes.generic),
        },
        {
            label: labels.rows.cdscoStatus,
            getValue: (m) => formatStatus(m.cdsco_approval_status, labels),
        },
        { label: labels.rows.expiryDate, getValue: (m) => formatExpiry(m.expiry_date) },
        {
            label: labels.rows.marketPrice,
            getValue: (m) => formatPrice(m.mrp, labels.priceUnavailable),
        },
        {
            label: labels.rows.janAushadhiPrice,
            getValue: (m) => formatPrice(m.jan_aushadhi_price, labels.priceUnavailable),
        },
        { label: labels.rows.savings, getValue: (m) => getSavingsText(m, labels) },
    ];

    const directSavings =
        medicine1 && medicine2
            ? computeDirectSavings(medicine1, medicine2, labels)
            : null;

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="w-1/4 px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                {labels.fieldHeader}
                            </th>
                            <th className="px-5 py-3 text-center text-sm font-semibold text-slate-800">
                                {medicine1 ? displayName(medicine1) : labels.medicineA}
                            </th>
                            <th className="px-5 py-3 text-center text-sm font-semibold text-slate-800">
                                {medicine2 ? displayName(medicine2) : labels.medicineB}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ label, getValue }) => (
                            <tr key={label} className="border-b border-slate-100 last:border-0">
                                <td className="px-5 py-3 font-medium text-slate-600">{label}</td>
                                <td className="px-5 py-3 text-center text-slate-800">
                                    {medicine1 ? getValue(medicine1) : "—"}
                                </td>
                                <td className="px-5 py-3 text-center text-slate-800">
                                    {medicine2 ? getValue(medicine2) : "—"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Direct savings summary card ── */}
            {directSavings && (
                <div className="flex items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                        <span className="text-lg" aria-hidden="true">💰</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                            Direct Savings
                        </p>
                        <p className="mt-0.5 text-sm text-emerald-700 dark:text-emerald-400">
                            {directSavings.summaryText}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                                ₹{directSavings.absoluteSaving.toFixed(2)} saved
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                                {directSavings.percentSaving.toFixed(1)}% cheaper
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}