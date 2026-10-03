// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const loginForm =
    document.getElementById("login-form");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const email =
                document.getElementById("email").value;

            const password =
                document.getElementById("password").value;

            const accountType =
                document.getElementById("account-type").value;

            const message =
                document.getElementById("login-message");


            message.textContent = "Logging in...";


            try {

                let endpoint;


                // Choose the correct login API
                if (accountType === "customer") {

                    endpoint =
                        `${API_URL}/auth/customer/login`;

                } else {

                    endpoint =
                        `${API_URL}/auth/login`;

                }


                const response =
                    await fetch(endpoint, {

                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            email: email,
                            password: password
                        })

                    });


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Login failed"
                    );

                }


                // =================================
                // CUSTOMER LOGIN
                // =================================

                if (accountType === "customer") {

                    localStorage.setItem(
                        "token",
                        data.token
                    );

                    localStorage.setItem(
                        "customer",
                        JSON.stringify(data.customer)
                    );

                    localStorage.setItem(
                        "customer_id",
                        String(
                            data.customer.customer_id
                        )
                    );


                    message.textContent =
                        "Login successful!";


                    window.location.href =
                        "customer/index.html";

                    return;
                }


                // =================================
                // ADMIN / STAFF LOGIN
                // =================================

                localStorage.setItem(
                    "token",
                    data.token
                );

                localStorage.setItem(
                    "user",
                    JSON.stringify(data.user)
                );


                message.textContent =
                    "Login successful!";


                if (data.user.role === "admin") {

                    window.location.href =
                        "admin/index.html";

                } else if (
                    data.user.role === "staff"
                ) {

                    window.location.href =
                        "staff/index.html";

                }


            } catch (error) {

                console.error(error);

                message.textContent =
                    error.message;

            }

        }
    );

}
