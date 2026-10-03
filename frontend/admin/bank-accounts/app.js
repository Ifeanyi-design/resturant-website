// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const accountsContainer =
    document.getElementById(
        "accounts-container"
    );

const formSection =
    document.getElementById(
        "form-section"
    );

const accountForm =
    document.getElementById(
        "account-form"
    );


// ========================================
// LOAD ACCOUNTS
// ========================================

async function loadAccounts() {

    try {

        const response =
            await fetch(
                `${API_URL}/bank-accounts`
            );

        const accounts =
            await response.json();

        if (accounts.length === 0) {

            accountsContainer.innerHTML = `
                <div class="account-card">
                    <p>
                        No bank accounts found.
                    </p>
                </div>
            `;

            return;
        }

        accountsContainer.innerHTML = "";

        accounts.forEach(account => {

            const active =
                Number(account.is_active) === 1;

            const card =
                document.createElement("div");

            card.className =
                "account-card";

            card.innerHTML = `

                <h3>
                    ${account.bank_name}
                </h3>

                <div class="account-info">
                    <strong>
                        Account Name:
                    </strong>

                    ${account.account_name}
                </div>

                <div class="account-info">
                    <strong>
                        Account Number:
                    </strong>

                    ${account.account_number}
                </div>

                <span
                    class="status ${
                        active
                            ? "active"
                            : "inactive"
                    }"
                >
                    ${
                        active
                            ? "Active"
                            : "Inactive"
                    }
                </span>

                <div class="account-actions">

                    <button
                        class="edit-btn"
                        onclick="editAccount(
                            ${account.account_id}
                        )"
                    >
                        Edit
                    </button>

                    <button
                        class="delete-btn"
                        onclick="deleteAccount(
                            ${account.account_id}
                        )"
                    >
                        Delete
                    </button>

                </div>
            `;

            accountsContainer.appendChild(card);

        });

    } catch (error) {

        console.error(error);

        accountsContainer.innerHTML = `
            <div class="account-card">
                <p>
                    Failed to load bank accounts.
                </p>
            </div>
        `;
    }
}


// ========================================
// SHOW ADD FORM
// ========================================

function showAddForm() {

    document.getElementById(
        "form-title"
    ).textContent =
        "Add Bank Account";

    accountForm.reset();

    document.getElementById(
        "account-id"
    ).value = "";

    document.getElementById(
        "is-active"
    ).checked = true;

    formSection.classList.remove(
        "hidden"
    );
}


// ========================================
// HIDE FORM
// ========================================

function hideForm() {

    formSection.classList.add(
        "hidden"
    );

    accountForm.reset();
}


// ========================================
// EDIT ACCOUNT
// ========================================

async function editAccount(accountId) {

    try {

        const response =
            await fetch(
                `${API_URL}/bank-accounts/${accountId}`
            );

        const account =
            await response.json();

        document.getElementById(
            "form-title"
        ).textContent =
            "Edit Bank Account";

        document.getElementById(
            "account-id"
        ).value =
            account.account_id;

        document.getElementById(
            "bank-name"
        ).value =
            account.bank_name;

        document.getElementById(
            "account-name"
        ).value =
            account.account_name;

        document.getElementById(
            "account-number"
        ).value =
            account.account_number;

        document.getElementById(
            "is-active"
        ).checked =
            Number(account.is_active) === 1;

        formSection.classList.remove(
            "hidden"
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    } catch (error) {

        console.error(error);

        alert(
            "Failed to load bank account."
        );
    }
}


// ========================================
// SAVE ACCOUNT
// ========================================

accountForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const accountId =
            document.getElementById(
                "account-id"
            ).value;

        const data = {

            bank_name:
                document.getElementById(
                    "bank-name"
                ).value,

            account_name:
                document.getElementById(
                    "account-name"
                ).value,

            account_number:
                document.getElementById(
                    "account-number"
                ).value,

            is_active:
                document.getElementById(
                    "is-active"
                ).checked
                    ? 1
                    : 0
        };

        try {

            let response;

            if (accountId) {

                response =
                    await fetch(
                        `${API_URL}/bank-accounts/${accountId}`,
                        {
                            method: "PUT",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            },
                            body:
                                JSON.stringify(data)
                        }
                    );

            } else {

                response =
                    await fetch(
                        `${API_URL}/bank-accounts`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            },
                            body:
                                JSON.stringify(data)
                        }
                    );
            }

            const result =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ||
                    "Failed to save account"
                );
            }

            alert(
                result.message ||
                "Bank account saved successfully."
            );

            hideForm();

            loadAccounts();

        } catch (error) {

            console.error(error);

            alert(error.message);
        }
    }
);


// ========================================
// DELETE ACCOUNT
// ========================================

async function deleteAccount(accountId) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this bank account?"
        );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_URL}/bank-accounts/${accountId}`,
                {
                    method: "DELETE"
                }
            );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Failed to delete account"
            );
        }

        alert(
            "Bank account deleted successfully."
        );

        loadAccounts();

    } catch (error) {

        console.error(error);

        alert(error.message);
    }
}


// ========================================
// LOGOUT
// ========================================

document
    .getElementById("logout-btn")
    .addEventListener("click", () => {

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href =
            "../../index.html";
    });


// ========================================
// START
// ========================================

loadAccounts();
