(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
        return;
    }

    root.PricingRules = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const BASE_AMOUNT = 185;
    const ADDITIONAL_ADVENTURER_INCREMENT = 185;
    const PRICING_RULES = [
        {
            title: "1 desbravador",
            amount: BASE_AMOUNT
        },
        {
            title: "2 desbravadores",
            amount: BASE_AMOUNT + ADDITIONAL_ADVENTURER_INCREMENT
        },
        {
            title: "Cada desbravador adicional",
            amount: ADDITIONAL_ADVENTURER_INCREMENT,
            prefix: "+"
        }
    ];

    function formatCurrency(value) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(value);
    }

    function calculateTotalAmount(adventurerCount) {
        const normalizedCount = Math.max(1, Number(adventurerCount) || 1);
        return BASE_AMOUNT + Math.max(0, normalizedCount - 1) * ADDITIONAL_ADVENTURER_INCREMENT;
    }

    function getPricingRule(adventurerCount) {
        const normalizedCount = Math.max(1, Number(adventurerCount) || 1);
        const amount = calculateTotalAmount(normalizedCount);
        const label = normalizedCount === 1
            ? `1 desbravador x ${formatCurrency(BASE_AMOUNT)}`
            : `${normalizedCount} desbravadores x ${formatCurrency(BASE_AMOUNT)}`;

        return {
            amount,
            label
        };
    }

    return {
        BASE_AMOUNT,
        ADDITIONAL_ADVENTURER_INCREMENT,
        PRICING_RULES,
        calculateTotalAmount,
        getPricingRule
    };
}));
