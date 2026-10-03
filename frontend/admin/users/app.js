// Base comes from js/api.js. The auth routes live under /api/auth.
const API_URL = window.api.base + '/auth';

const userForm = document.getElementById('user-form');
const usersTable = document.getElementById('users-table');


// ===============================
// LOAD USERS
// ===============================

async function loadUsers() {

    try {

        const response = await fetch(`${API_URL}/users`);

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const users = await response.json();

        usersTable.innerHTML = '';

        if (users.length === 0) {

            usersTable.innerHTML = `
                <tr>
                    <td colspan="6">
                        No users found.
                    </td>
                </tr>
            `;

            return;
        }


        users.forEach(user => {

            const row = document.createElement('tr');

            const createdDate = user.created_at
                ? new Date(user.created_at).toLocaleString()
                : '-';


            row.innerHTML = `
                <td>${user.user_id}</td>

                <td>
                    ${user.first_name} ${user.last_name}
                </td>

                <td>
                    ${user.email}
                </td>

                <td>
                    ${user.role}
                </td>

                <td>
                    ${createdDate}
                </td>

                <td>

                    <button
                        class="action-btn edit-btn"
                        onclick="editUser(${user.user_id})"
                    >
                        Edit
                    </button>

                    <button
                        class="action-btn delete-btn"
                        onclick="deleteUser(${user.user_id})"
                    >
                        Delete
                    </button>

                </td>
            `;

            usersTable.appendChild(row);

        });

    } catch (error) {

        console.error(error);

        usersTable.innerHTML = `
            <tr>
                <td colspan="6">
                    Failed to load users.
                </td>
            </tr>
        `;
    }
}


// ===============================
// ADD / UPDATE USER
// ===============================

userForm.addEventListener('submit', async function(event) {

    event.preventDefault();


    const userId =
        document.getElementById('user_id').value;

    const firstName =
        document.getElementById('first_name').value.trim();

    const lastName =
        document.getElementById('last_name').value.trim();

    const email =
        document.getElementById('email').value.trim();

    const password =
        document.getElementById('password').value;

    const role =
        document.getElementById('role').value;


    try {

        let response;


        if (userId) {

            // ==========================
            // UPDATE USER
            // ==========================

            const data = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                role: role
            };


            // Only send password when user entered one
            if (password) {
                data.password = password;
            }


            response = await fetch(
                `${API_URL}/users/${userId}`,
                {
                    method: 'PUT',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify(data)
                }
            );

        } else {

            // ==========================
            // CREATE USER
            // ==========================

            if (!password) {

                alert('Password is required when creating a user.');

                return;
            }


            response = await fetch(
                `${API_URL}/users`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        password: password,
                        role: role
                    })
                }
            );
        }


        const result = await response.json();


        if (!response.ok) {

            alert(result.error || result.message || 'Operation failed');

            return;
        }


        alert(
            userId
                ? 'User updated successfully'
                : 'User created successfully'
        );


        cancelEdit();

        await loadUsers();

    } catch (error) {

        console.error(error);

        alert('Could not connect to the server');
    }

});


// ===============================
// EDIT USER
// ===============================

async function editUser(userId) {

    try {

        const response = await fetch(
            `${API_URL}/users/${userId}`
        );

        const user = await response.json();


        if (!response.ok) {

            alert(user.error || 'Failed to load user');

            return;
        }


        document.getElementById('user_id').value =
            user.user_id;

        document.getElementById('first_name').value =
            user.first_name;

        document.getElementById('last_name').value =
            user.last_name;

        document.getElementById('email').value =
            user.email;

        document.getElementById('role').value =
            user.role;

        // Do not display the existing password
        document.getElementById('password').value = '';

        document.getElementById('password').placeholder =
            'Leave blank to keep current password';


        document.getElementById('password-help').textContent =
            'Leave blank to keep the current password. Enter a new password to change it.';


        document.getElementById('form-title').textContent =
            'Edit User';

        document.getElementById('cancel-btn').style.display =
            'inline-block';


        document.querySelector('.form-section')
            .scrollIntoView({
                behavior: 'smooth'
            });

    } catch (error) {

        console.error(error);

        alert('Failed to load user');
    }
}


// ===============================
// DELETE USER
// ===============================

async function deleteUser(userId) {

    if (userId === 1) {

        alert(
            'The main administrator account cannot be deleted from this page.'
        );

        return;
    }


    const confirmed = confirm(
        'Are you sure you want to delete this user?'
    );


    if (!confirmed) {
        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/users/${userId}`,
            {
                method: 'DELETE'
            }
        );


        const result = await response.json();


        if (!response.ok) {

            alert(result.error || 'Failed to delete user');

            return;
        }


        alert('User deleted successfully');

        await loadUsers();

    } catch (error) {

        console.error(error);

        alert('Could not connect to the server');
    }
}


// ===============================
// CANCEL EDIT
// ===============================

function cancelEdit() {

    userForm.reset();

    document.getElementById('user_id').value = '';

    document.getElementById('form-title').textContent =
        'Add User';

    document.getElementById('cancel-btn').style.display =
        'none';

    document.getElementById('password').placeholder =
        'Password';

    document.getElementById('password-help').textContent =
        'Password must be at least 6 characters.';
}


// ===============================
// INITIAL LOAD
// ===============================

loadUsers();
