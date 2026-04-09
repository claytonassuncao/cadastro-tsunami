const samplePayload = {
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
    foreignCustomer: false
};

const API_URL = "https://cadastro-tsunami-479954408223.southamerica-east1.run.app/api/customers";

const form = document.querySelector("#customerForm");
const fillSampleButton = document.querySelector("#fillSample");
const submitButton = form?.querySelector('button[type="submit"]');
const upperCaseFields = ["name", "address", "complement", "province", "observations"];
const lowerCaseFields = ["email"];
const cpfField = document.querySelector("#cpfCnpj");
const postalCodeField = document.querySelector("#postalCode");
const phoneField = document.querySelector("#phone");
const mobilePhoneField = document.querySelector("#mobilePhone");
const defaultSubmitButtonText = submitButton?.textContent ?? "Enviar Cadastro";
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
    if(trimmedValue === ""){
        return null;
    }

    const digitsOnly = normalizeDigits(trimmedValue);
    return digitsOnly === "" ? null : Number(digitsOnly);
}

function getNullableDigitsString(value) {
    const digitsOnly = normalizeDigits(value);
    return digitsOnly === "" ? null : digitsOnly;
}

function getNullableCpfString(value) {
    const formattedCpf = formatCpf(value);
    return formattedCpf === "" ? null : formattedCpf;
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

function applyInputTransforms(event) {
    const { target } = event;

    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
        return;
    }

    if (upperCaseFields.includes(target.name)) {
        target.value = String(target.value).toLocaleUpperCase("pt-BR");
    }

    if (lowerCaseFields.includes(target.name)) {
        target.value = String(target.value).toLocaleLowerCase("pt-BR");
    }
}

function buildPayload() {
    const formData = new FormData(form);

    return {
        name: normalizeUpperCase(formData.get("name")),
        cpfCnpj: getNullableCpfString(formData.get("cpfCnpj")),
        email: normalizeLowerCase(formData.get("email")),
        phone: getNullableDigitsString(formData.get("phone")),
        mobilePhone: getNullableDigitsString(formData.get("mobilePhone")),
        address: getNullableText(normalizeUpperCase(formData.get("address"))),
        addressNumber: getNullableNumber(formData.get("addressNumber")),
        complement: getNullableText(normalizeUpperCase(formData.get("complement"))),
        province: getNullableText(normalizeUpperCase(formData.get("province"))),
        postalCode: getNullableText(formData.get("postalCode")),
        externalReference: getNullableNumber(formData.get("externalReference")),
        notificationDisabled: formData.get("notificationDisabled") === "on",
        additionalEmails: getNullableText(normalizeLowerCase(formData.get("additionalEmails"))),
        municipalInscription: getNullableNumber(formData.get("municipalInscription")),
        stateInscription: getNullableNumber(formData.get("stateInscription")),
        observations: getNullableText(normalizeUpperCase(formData.get("observations"))),
        groupName: getNullableText(normalizeUpperCase(formData.get("groupName"))),
        company: getNullableText(normalizeUpperCase(formData.get("company"))),
        foreignCustomer: formData.get("foreignCustomer") === "on"
    };
}

function fillForm(payload) {
    Object.entries(payload).forEach(([key, value]) => {
        const field = form.elements.namedItem(key);
        if (!field) {
            return;
        }

        if (field.type === "checkbox") {
            field.checked = Boolean(value);
            return;
        }

        field.value = value ?? "";
    });
}

function resetForm() {
    form.reset();
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

form.addEventListener("input", applyInputTransforms);

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

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
        return;
    }

    const payload = buildPayload();

    if (!payload.name || !payload.email || !payload.cpfCnpj) {
        await Swal.fire({
            icon: "error",
            title: "Campos obrigatorios",
            text: "Preencha nome, e-mail e CPF/CNPJ corretamente."
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
        await submitPayload(payload);
        Swal.close();
        await Swal.fire({
            icon: "success",
            title: "Cadastro enviado",
            text: "Cadastro Enviado com Sucesso!"
        });
        resetForm();
    } catch (error) {
        Swal.close();
        await Swal.fire({
            icon: "error",
            title: "Erro ao enviar",
            text: error.message || "Nao foi possivel concluir o envio."
        });
        resetForm();
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
