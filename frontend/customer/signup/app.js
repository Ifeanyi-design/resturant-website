// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;


const signupForm =
    document.getElementById("signup-form");


signupForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const firstName =
            document.getElementById("first-name").value.trim();

        const lastName =
            document.getElementById("last-name").value.trim();

        const phone =
            document.getElementById("phone").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;

        const confirmPassword =
            document.getElementById("confirm-password").value;

        const message =
            document.getElementById("signup-message");

        const signupButton =
            document.getElementById("signup-btn");


        // Check passwords
        if (password !== confirmPassword) {

            message.textContent =
                "Passwords do not match.";

            return;
        }


        if (password.length < 6) {

            message.textContent =
                "Password must be at least 6 characters.";

            return;
        }


        signupButton.disabled = true;

        signupButton.textContent =
            "Creating Account...";

        message.textContent = "";


        try {

            const response =
                await fetch(
                    `${API_URL}/auth/customer/signup`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            first_name: firstName,

                            last_name: lastName,

                            phone: phone || null,

                            email: email,

                            password: password

                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to create account"
                );

            }


            message.textContent =
                "Account created successfully!";


            message.style.color =
                "#28a745";


            signupButton.textContent =
                "Account Created";


            // Wait briefly then go to login
            setTimeout(() => {

                window.location.href =
                    "../../index.html";

            }, 1500);


        } catch (error) {

            console.error(error);


            message.textContent =
                error.message;


            message.style.color =
                "#dc3545";


            signupButton.disabled = false;

            signupButton.textContent =
                "Create Account";

        }

    }
);
