const samplePayload = {
    environment: "production",
    name: "",
    cpfCnpj: null,
    email: "",
    phone: null,
    mobilePhone: null,
    address: "",
    addressNumber: null,
    complement: "",
    province: "",
    postalCode: "",
    externalReference: null,
    notificationDisabled: false,
    additionalEmails: "",
    municipalInscription: null,
    stateInscription: null,
    observations: "",
    groupName: null,
    company: null,
    foreignCustomer: false,
    adventurers: [""]
};

const pricingApi = window.PricingRules;
const getPricingRule = pricingApi?.getPricingRule ?? (() => ({
    amount: 185,
    label: "Faixa vigente da v1.0"
}));

const API_URL = "/api/registrations";

const form = document.querySelector("#customerForm");
const fillSampleButton = document.querySelector("#fillSample");
const submitButton = form?.querySelector('button[type="submit"]');
const environmentInputs = document.querySelectorAll('input[name="environment"]');
const cpfField = document.querySelector("#cpfCnpj");
const postalCodeField = document.querySelector("#postalCode");
const phoneField = document.querySelector("#phone");
const mobilePhoneField = document.querySelector("#mobilePhone");
const addAdventurerButton = document.querySelector("#addAdventurerButton");
const adventurersList = document.querySelector("#adventurersList");
const adventurerCountValue = document.querySelector("#adventurerCountValue");
const monthlyAmountValue = document.querySelector("#monthlyAmountValue");
const billingTierValue = document.querySelector("#billingTierValue");
const defaultSubmitButtonText = submitButton?.textContent ?? "Enviar Cadastro";
const upperCaseFields = ["name", "address", "complement", "province", "observations"];
const lowerCaseFields = ["email"];
let isSubmitting = false;

function normalizeDigits(value) {
    return String(value ?? "").replace(/\D/g, "");
}

function normalizeUpperCase(value) {
    return String(value ?? "").toLocaleUpperCase("pt-BR").trim();
}

function normalizeLowerCase(value) {
    return String(value ?? "").toLocaleLowerCase("pt-BR").trim();
}

function getNullableText(value) {
    const trimmedValue = String(value ?? "").trim();
    return trimmedValue === "" ? null : trimmedValue;
}

function getNullableNumber(value) {
    const trimmedValue = String(value ?? "").trim();
    if (trimmedValue === "") {
        return null;
    }

    const digitsOnly = normalizeDigits(trimmedValue);
    return digitsOnly === "" ? null : Number(digitsOnly);
}

function getNullableDigitsString(value) {
    const digitsOnly = normalizeDigits(value);
    return digitsOnly === "" ? null : digitsOnly;
}

function formatCpf(value) {
    const digits = normalizeDigits(value).slice(0, 11);

    return digits
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPostalCode(value) {
    const digits = normalizeDigits(value).slice(0, 8);
    return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

function formatPhone(value) {
    const digits = normalizeDigits(value).slice(0, 11);

    if (digits.length <= 2) {
        return digits;
    }

    if (digits.length <= 7) {
        return digits.replace(/^(\d{2})(\d+)/, "($1)$2");
    }

    return digits.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1)$2-$3").replace(/-$/, "");
}

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(value);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function createAdventurerMarkup(index, value = "") {
    return `
        <tr data-adventurer-item>
            <th scope="row" class="adventurer-row-index">
                <span class="adventurer-badge">${index + 1}</span>
            </th>
            <td>
                <label class="form-label visually-hidden" for="adventurerName${index}">
                    Nome completo do desbravador ${index + 1}
                </label>
                <input
                    id="adventurerName${index}"
                    name="adventurerName[]"
                    type="text"
                    class="form-control form-control-lg"
                    data-transform="upper"
                    value="${escapeHtml(value)}"
                    placeholder="Digite o nome completo do desbravador"
                    required
                >
            </td>
            <td class="adventurer-row-action">
                <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm remove-adventurer-button"
                    data-remove-adventurer
                >
                    Remover
                </button>
            </td>
        </tr>
    `;
}

function updateAdventurerControls() {
    const items = Array.from(adventurersList?.querySelectorAll("[data-adventurer-item]") ?? []);

    items.forEach((item, index) => {
        const badge = item.querySelector(".adventurer-badge");
        const label = item.querySelector("label");
        const input = item.querySelector('input[name="adventurerName[]"]');
        const removeButton = item.querySelector("[data-remove-adventurer]");

        if (badge) {
            badge.textContent = String(index + 1);
        }

        if (input) {
            input.id = `adventurerName${index}`;
        }

        if (label) {
            label.htmlFor = `adventurerName${index}`;
        }

        if (removeButton) {
            removeButton.hidden = items.length === 1;
        }
    });
}

function renderAdventurers(values = [""]) {
    if (!adventurersList) {
        return;
    }

    const safeValues = values.length > 0 ? values : [""];
    adventurersList.innerHTML = safeValues
        .map((value, index) => createAdventurerMarkup(index, value))
        .join("");

    updateAdventurerControls();
}

function appendAdventurer(value = "") {
    if (!adventurersList) {
        return;
    }

    const nextIndex = adventurersList.querySelectorAll("[data-adventurer-item]").length;
    adventurersList.insertAdjacentHTML("beforeend", createAdventurerMarkup(nextIndex, value));
    updateAdventurerControls();
}

function getAdventurerNames() {
    return Array.from(form?.querySelectorAll('input[name="adventurerName[]"]') ?? [])
        .map((input) => normalizeUpperCase(input.value))
        .filter(Boolean);
}

function hasIncompleteAdventurerNames() {
    return Array.from(form?.querySelectorAll('input[name="adventurerName[]"]') ?? [])
        .some((input) => normalizeUpperCase(input.value) === "");
}

function updatePricingSummary() {
    const adventurerNames = getAdventurerNames();
    const rule = getPricingRule(adventurerNames.length);

    if (adventurerCountValue) {
        adventurerCountValue.textContent = String(adventurerNames.length || 1);
    }

    if (monthlyAmountValue) {
        monthlyAmountValue.textContent = formatCurrency(rule.amount);
    }

    if (billingTierValue) {
        billingTierValue.textContent = rule.label;
    }
}

function applyInputTransforms(event) {
    const { target } = event;

    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
        return;
    }

    if (upperCaseFields.includes(target.name) || target.dataset.transform === "upper") {
        target.value = String(target.value).toLocaleUpperCase("pt-BR");
    }

    if (lowerCaseFields.includes(target.name) || target.dataset.transform === "lower") {
        target.value = String(target.value).toLocaleLowerCase("pt-BR");
    }
}

function buildRegistrationSummary(adventurerNames, customerNotes) {
    const rule = getPricingRule(adventurerNames.length);
    const summaryParts = [
        `QTD. DESBRAVADORES: ${Math.max(1, adventurerNames.length)}`,
        `VALOR TOTAL A PAGAR: ${formatCurrency(rule.amount)}`,
        `FAIXA: ${rule.label.toLocaleUpperCase("pt-BR")}`,
        adventurerNames.length > 0
            ? `DESBRAVADORES: ${adventurerNames.join(", ")}`
            : "DESBRAVADORES: NAO INFORMADOS"
    ];

    if (customerNotes) {
        summaryParts.unshift(customerNotes);
    }

    return summaryParts.join(" | ");
}

function normalizeEnvironment(value) {
    return value === "production" ? "production" : "development";
}

function getSelectedEnvironment() {
    const selectedInput = Array.from(environmentInputs).find((input) => input.checked);
    return normalizeEnvironment(selectedInput?.value);
}

function setSelectedEnvironment(value) {
    const normalizedValue = normalizeEnvironment(value);

    environmentInputs.forEach((input) => {
        input.checked = input.value === normalizedValue;
    });
}

function buildCustomerPayload(formData, customerNotes, adventurerNames) {
    return {
        name: normalizeUpperCase(formData.get("name")),
        cpfCnpj: getNullableText(formData.get("cpfCnpj")),
        email: normalizeLowerCase(formData.get("email")),
        phone: getNullableDigitsString(formData.get("phone")),
        mobilePhone: getNullableDigitsString(formData.get("mobilePhone")),
        address: getNullableText(normalizeUpperCase(formData.get("address"))),
        addressNumber: getNullableNumber(formData.get("addressNumber")),
        complement: getNullableText(normalizeUpperCase(formData.get("complement"))),
        province: getNullableText(normalizeUpperCase(formData.get("province"))),
        postalCode: getNullableText(formData.get("postalCode")),
        externalReference: getNullableNumber(formData.get("externalReference")),
        notificationDisabled: false,
        additionalEmails: getNullableText(normalizeLowerCase(formData.get("additionalEmails"))),
        municipalInscription: getNullableNumber(formData.get("municipalInscription")),
        stateInscription: getNullableNumber(formData.get("stateInscription")),
        observations: getNullableText(buildRegistrationSummary(adventurerNames, customerNotes)),
        groupName: getNullableText(normalizeUpperCase(formData.get("groupName"))),
        company: getNullableText(normalizeUpperCase(formData.get("company"))),
        foreignCustomer: formData.get("foreignCustomer") === "on"
    };
}

function buildRegistrationPayload() {
    const formData = new FormData(form);
    const adventurerNames = getAdventurerNames();
    const customerNotes = getNullableText(normalizeUpperCase(formData.get("observations")));
    const billingRule = getPricingRule(adventurerNames.length);

    return {
        version: "v1.0",
        environment: getSelectedEnvironment(),
        notes: customerNotes,
        customer: buildCustomerPayload(formData, customerNotes, adventurerNames),
        adventurers: adventurerNames.map((name, index) => ({
            id: `adv_${index + 1}`,
            name
        })),
        billing: {
            adventurerCount: Math.max(1, adventurerNames.length),
            amount: billingRule.amount,
            ruleLabel: billingRule.label
        }
    };
}

function fillForm(payload) {
    Object.entries(payload).forEach(([key, value]) => {
        if (key === "environment") {
            setSelectedEnvironment(value);
            return;
        }

        if (key === "adventurers") {
            renderAdventurers(Array.isArray(value) && value.length > 0 ? value : [""]);
            return;
        }

        const field = form?.elements.namedItem(key);
        if (!field) {
            return;
        }

        if ("value" in field && !("type" in field)) {
            field.value = value ?? "";
            return;
        }

        if (field.type === "checkbox") {
            field.checked = Boolean(value);
            return;
        }

        field.value = value ?? "";
    });

    updatePricingSummary();
}

function resetForm() {
    form.reset();
    setSelectedEnvironment(samplePayload.environment);
    renderAdventurers([""]);
    updatePricingSummary();
}

function setSubmittingState(submitting) {
    isSubmitting = submitting;

    if (!submitButton) {
        return;
    }

    submitButton.disabled = submitting;
    submitButton.textContent = submitting ? "Enviando..." : defaultSubmitButtonText;
    submitButton.setAttribute("aria-busy", String(submitting));
}

if (cpfField) {
    cpfField.addEventListener("input", (event) => {
        event.target.value = formatCpf(event.target.value);
    });
}

if (postalCodeField) {
    postalCodeField.addEventListener("input", (event) => {
        event.target.value = formatPostalCode(event.target.value);
    });
}

if (phoneField) {
    phoneField.addEventListener("input", (event) => {
        event.target.value = formatPhone(event.target.value);
    });
}

if (mobilePhoneField) {
    mobilePhoneField.addEventListener("input", (event) => {
        event.target.value = formatPhone(event.target.value);
    });
}

if (addAdventurerButton) {
    addAdventurerButton.addEventListener("click", () => {
        appendAdventurer("");
        updatePricingSummary();

        const inputs = adventurersList?.querySelectorAll('input[name="adventurerName[]"]');
        const newInput = inputs?.[inputs.length - 1];
        newInput?.focus();
    });
}

if (adventurersList) {
    adventurersList.addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-remove-adventurer]");
        if (!removeButton) {
            return;
        }

        const items = adventurersList.querySelectorAll("[data-adventurer-item]");
        if (items.length === 1) {
            return;
        }

        removeButton.closest("[data-adventurer-item]")?.remove();
        updateAdventurerControls();
        updatePricingSummary();
    });
}

form?.addEventListener("input", (event) => {
    applyInputTransforms(event);
    updatePricingSummary();
});

form?.addEventListener("reset", () => {
    window.requestAnimationFrame(() => {
        renderAdventurers([""]);
        updatePricingSummary();
    });
});

async function submitPayload(payload) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errorMessage = "Falha ao enviar o payload.";

        try {
            const errorData = await response.json();
            if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                errorMessage = errorData.errors.map((item) => item.description || item.code).join(" | ");
            } else {
                errorMessage = [
                    errorData.message,
                    errorData.details,
                    errorData.error
                ].filter(Boolean).join(" | ") || JSON.stringify(errorData);
            }
        } catch (jsonError) {
            const errorText = await response.text();
            if (errorText) {
                errorMessage = errorText;
            }
        }
        throw new Error(errorMessage);
    }

    try {
        return await response.json();
    } catch (jsonError) {
        return null;
    }
}

form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
        return;
    }

    const payload = buildRegistrationPayload();
    const adventurerNames = payload.adventurers;

    if (!payload.customer.name || !payload.customer.email || !payload.customer.cpfCnpj) {
        await Swal.fire({
            icon: "error",
            title: "Campos obrigatorios",
            text: "Preencha nome, e-mail e CPF/CNPJ corretamente."
        });
        return;
    }

    if (adventurerNames.length === 0 || hasIncompleteAdventurerNames()) {
        await Swal.fire({
            icon: "error",
            title: "Desbravadores pendentes",
            text: "Adicione pelo menos um desbravador e preencha todos os nomes antes de enviar."
        });
        return;
    }

    setSubmittingState(true);
    Swal.fire({
        title: "Aguarde...",
        text: "Enviando Cadastro. Aguarde...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const result = await submitPayload(payload);
        Swal.close();

        const monthlyAmount = result?.registration?.billing?.amount;
        const subscriptionId = result?.asaas?.subscription?.id;
        const environmentLabel = result?.environment?.label;
        const warningText = Array.isArray(result?.warnings) && result.warnings.length > 0
            ? result.warnings.join(" | ")
            : null;

        await Swal.fire({
            icon: warningText ? "warning" : "success",
            title: warningText ? "Cadastro salvo com ressalvas" : "Cadastro enviado",
            text: warningText || [
                "Cadastro enviado com sucesso.",
                environmentLabel ? `Ambiente utilizado: ${environmentLabel}.` : null,
                monthlyAmount ? `Valor total registrado para o responsavel: ${formatCurrency(monthlyAmount)}.` : null,
                subscriptionId ? `Assinatura Asaas: ${subscriptionId}.` : null
            ].filter(Boolean).join(" ")
        });
        resetForm();
    } catch (error) {
        Swal.close();
        await Swal.fire({
            icon: "error",
            title: "Erro ao enviar",
            text: error.message || "Nao foi possivel concluir o envio."
        });
    } finally {
        setSubmittingState(false);
    }
});

if (fillSampleButton) {
    fillSampleButton.addEventListener("click", () => {
        fillForm(samplePayload);
    });
}

fillForm(samplePayload);
