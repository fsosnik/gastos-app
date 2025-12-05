const app = {
    currentUser: null,
    currentGroupId: null,
    currentGroupCurrency: 'USD',
    participants: [],

    init: async function () {
        console.log('App initialized 🚀');
        this.initTheme();
        // Check for Reset Token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('reset_token');

        if (resetToken) {
            this.showResetPasswordView(resetToken);
        } else {
            await this.checkAuth();
        }
    },

    // --- Theme ---
    initTheme: function () {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            this.updateThemeIcon(true);
        } else {
            document.documentElement.classList.remove('dark');
            this.updateThemeIcon(false);
        }
    },

    toggleTheme: function () {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
            this.updateThemeIcon(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
            this.updateThemeIcon(true);
        }
    },

    updateThemeIcon: function (isDark) {
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.className = isDark ? 'fas fa-sun text-yellow-300' : 'fas fa-moon';
        }
    },

    // --- Auth ---

    checkAuth: async function () {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data;
                document.getElementById('user-display-name').innerText = data.name;

                // Update Avatar
                const avatarUrl = data.avatar_path || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=random`;
                document.getElementById('nav-user-avatar').src = avatarUrl;

                document.getElementById('nav-user-avatar').src = avatarUrl;

                // Show Menu & Nav Actions
                document.getElementById('user-menu-container').classList.remove('hidden');
                document.getElementById('user-menu-container').classList.add('flex');
                document.getElementById('nav-actions').classList.remove('hidden'); // Show nav actions

                // Admin Button
                if (data.is_admin) {
                    document.getElementById('nav-item-admin').classList.remove('hidden');
                } else {
                    document.getElementById('nav-item-admin').classList.add('hidden');
                }

                this.showHome();
            } else {
                this.showLanding(); // Default to landing instead of login
            }
        } catch (error) {
            console.error('Error checking auth:', error);
            this.showLanding();
        }
    },

    login: async function () {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) return alert('Completa todos los campos');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.showHome();
                this.updateNav(true);
            } else {
                alert('Credenciales inválidas ❌');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Error al iniciar sesión');
        }
    },

    register: async function () {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        if (!name || !email || !password) return alert('Completa todos los campos');

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            if (response.ok) {
                alert('Registro exitoso! Por favor inicia sesión. ✅');
                this.showLogin();
            } else {
                const data = await response.json();
                alert(data.error || 'Error al registrarse');
            }
        } catch (error) {
            console.error('Register error:', error);
            alert('Error al registrarse');
        }
    },

    logout: async function () {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            this.currentUser = null;
            this.currentGroupId = null;
            document.getElementById('nav-actions').classList.add('hidden'); // Hide nav actions
            document.getElementById('user-menu-container').classList.add('hidden');
            document.getElementById('user-menu-container').classList.remove('flex');

            this.showLanding();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    },

    updateNav: function (isLoggedIn) {
        const navActions = document.getElementById('nav-actions');
        const userDisplay = document.getElementById('user-display-name');
        const btnLogout = document.getElementById('btn-logout');

        if (isLoggedIn) {
            navActions.classList.remove('hidden');
            userDisplay.innerText = `Hola, ${this.currentUser.name} 👋`;
            userDisplay.classList.remove('hidden');
            btnLogout.classList.remove('hidden');
        } else {
            navActions.classList.add('hidden');
            userDisplay.classList.add('hidden');
            btnLogout.classList.add('hidden');
        }
    },

    // --- Navigation & Views ---

    hideAllViews: function () {
        document.getElementById('view-landing').classList.add('hidden'); // Landing
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-register').classList.add('hidden');
        document.getElementById('view-home').classList.add('hidden');
        document.getElementById('view-group').classList.add('hidden');
        document.getElementById('view-profile').classList.add('hidden');
        document.getElementById('view-admin').classList.add('hidden');
        document.getElementById('view-forgot-password').classList.add('hidden');
        document.getElementById('view-reset-password').classList.add('hidden');

        // Hide group specific nav items
        document.getElementById('nav-btn-expenses').classList.add('hidden');
        document.getElementById('nav-btn-balances').classList.add('hidden');
        document.getElementById('user-dropdown').classList.add('hidden'); // Close dropdown
    },

    showLanding: function () {
        this.hideAllViews();
        document.getElementById('view-landing').classList.remove('hidden');
    },

    showLogin: function () {
        this.hideAllViews();
        document.getElementById('view-login').classList.remove('hidden');
        document.getElementById('user-menu-container').classList.add('hidden');
        document.getElementById('user-menu-container').classList.remove('flex');
    },

    showForgotPassword: function () {
        this.hideAllViews();
        document.getElementById('view-forgot-password').classList.remove('hidden');
    },

    showResetPasswordView: function (token) {
        this.hideAllViews();
        document.getElementById('reset-token').value = token; // Store token in hidden input
        document.getElementById('view-reset-password').classList.remove('hidden');
    },

    requestPasswordReset: async function () {
        const email = document.getElementById('forgot-email').value;
        if (!email) return alert('Por favor ingresa tu email.');

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            alert(data.message);
            if (response.ok) this.showLogin();
        } catch (error) {
            console.error(error);
            alert('Error al solicitar recuperación.');
        }
    },

    resetPassword: async function () {
        const token = document.getElementById('reset-token').value;
        const newPassword = document.getElementById('reset-new-password').value;

        if (!newPassword) return alert('Ingresa una nueva contraseña.');

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: newPassword })
            });
            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                // Clear URL params so refresh doesn't trigger reset again
                window.history.replaceState({}, document.title, "/");
                this.showLogin();
            } else {
                alert(data.error || 'Error al restablecer contraseña.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al restablecer contraseña.');
        }
    },

    showRegister: function () {
        this.hideAllViews();
        document.getElementById('view-register').classList.remove('hidden');
    },

    showHome: function () {
        if (!this.currentUser) return this.showLanding(); // Redirect if not logged URLSearchParams

        this.hideAllViews();
        document.getElementById('view-home').classList.remove('hidden');

        // Make sure nav actions are visible 
        document.getElementById('nav-actions').classList.remove('hidden');

        this.currentGroupId = null;
        this.loadRecentGroups();
    },

    showAdminView: function () {
        this.hideAllViews();
        document.getElementById('view-admin').classList.remove('hidden');
        this.switchAdminTab('users'); // Default tab
    },

    // --- Admin Logic ---

    switchAdminTab: function (tabName) {
        const usersContainer = document.getElementById('admin-users-container');
        const groupsContainer = document.getElementById('admin-groups-container');
        const tabUsers = document.getElementById('tab-admin-users');
        const tabGroups = document.getElementById('tab-admin-groups');

        if (tabName === 'users') {
            usersContainer.classList.remove('hidden');
            groupsContainer.classList.add('hidden');
            tabUsers.classList.add('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400', 'dark:border-indigo-400');
            tabUsers.classList.remove('border-transparent', 'text-gray-500');
            tabGroups.classList.remove('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400', 'dark:border-indigo-400');
            tabGroups.classList.add('border-transparent', 'text-gray-500');
            this.loadAdminUsers();
        } else {
            usersContainer.classList.add('hidden');
            groupsContainer.classList.remove('hidden');
            tabGroups.classList.add('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400', 'dark:border-indigo-400');
            tabGroups.classList.remove('border-transparent', 'text-gray-500');
            tabUsers.classList.remove('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400', 'dark:border-indigo-400');
            tabUsers.classList.add('border-transparent', 'text-gray-500');
            this.loadAdminGroups();
        }
    },

    loadAdminUsers: async function () {
        try {
            const response = await fetch('/api/admin/users');
            if (response.ok) {
                const users = await response.json();
                const tbody = document.getElementById('admin-users-list');
                tbody.innerHTML = '';
                users.forEach(user => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition';
                    tr.innerHTML = `
                        <td class="px-6 py-4 dark:text-gray-300">#${user.id}</td>
                        <td class="px-6 py-4 font-medium dark:text-white">${user.name}</td>
                        <td class="px-6 py-4 dark:text-gray-300">${user.email}</td>
                        <td class="px-6 py-4">
                            ${user.is_admin ? '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full dark:bg-yellow-900 dark:text-yellow-200">Admin</span>' : '<span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full dark:bg-gray-700 dark:text-gray-300">User</span>'}
                        </td>
                        <td class="px-6 py-4 text-right">
                             ${!user.is_admin ? `<button onclick="app.deleteUser(${user.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"><i class="fas fa-trash"></i></button>` : ''}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (error) {
            console.error('Error loading admin users:', error);
        }
    },

    loadAdminGroups: async function () {
        try {
            const response = await fetch('/api/admin/groups');
            if (response.ok) {
                const groups = await response.json();
                const tbody = document.getElementById('admin-groups-list');
                tbody.innerHTML = '';
                groups.forEach(group => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition';
                    tr.innerHTML = `
                         <td class="px-6 py-4 dark:text-gray-300">#${group.id}</td>
                         <td class="px-6 py-4 font-medium dark:text-white">${group.name}</td>
                         <td class="px-6 py-4 dark:text-gray-300">${group.created_by_name}</td>
                         <td class="px-6 py-4 dark:text-gray-300">${group.participant_count}</td>
                         <td class="px-6 py-4 dark:text-gray-300 text-xs">${new Date(group.created_at).toLocaleDateString()}</td>
                         <td class="px-6 py-4 text-right">
                             <button onclick="app.deleteGroup(${group.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"><i class="fas fa-trash"></i></button>
                         </td>
                     `;
                    tbody.appendChild(tr);
                });
            }
        } catch (error) {
            console.error('Error loading admin groups:', error);
        }
    },

    deleteUser: async function (id) {
        if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) return;
        try {
            const response = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            if (response.ok) {
                this.loadAdminUsers();
            } else {
                alert('No se pudo eliminar el usuario.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al eliminar usuario.');
        }
    },

    deleteGroup: async function (id) {
        if (!confirm('¿Estás seguro de eliminar este grupo? Se borrarán todos sus gastos.')) return;
        try {
            const response = await fetch(`/api/admin/groups/${id}`, { method: 'DELETE' });
            if (response.ok) {
                this.loadAdminGroups();
            } else {
                alert('No se pudo eliminar el grupo.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al eliminar grupo.');
        }
    },

    showGroupView: async function (groupId) {
        if (!this.currentUser) return this.showLogin();

        this.currentGroupId = groupId;
        this.hideAllViews();
        document.getElementById('view-group').classList.remove('hidden');

        // Show group specific nav items
        document.getElementById('nav-btn-expenses').classList.remove('hidden');
        document.getElementById('nav-btn-balances').classList.remove('hidden');

        await this.loadGroupData(groupId);
        this.switchTab('expenses');
    },

    showProfileView: function () {
        this.hideAllViews();
        document.getElementById('view-profile').classList.remove('hidden');

        // Populate Data
        document.getElementById('profile-name').value = this.currentUser.name;
        const avatarUrl = this.currentUser.avatar_path || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.name)}&background=random`;
        document.getElementById('profile-avatar').src = avatarUrl;

        // Clear password fields
        document.getElementById('profile-current-password').value = '';
        document.getElementById('profile-new-password').value = '';
    },

    switchTab: function (tabName) {
        const expensesContainer = document.getElementById('expenses-container');
        const balancesContainer = document.getElementById('balances-container');
        const tabExpenses = document.getElementById('tab-expenses');
        const tabBalances = document.getElementById('tab-balances');

        if (tabName === 'expenses') {
            expensesContainer.classList.remove('hidden');
            balancesContainer.classList.add('hidden');
            tabExpenses.classList.add('border-indigo-600', 'text-indigo-600');
            tabExpenses.classList.remove('border-transparent', 'text-gray-500');
            tabBalances.classList.remove('border-indigo-600', 'text-indigo-600');
            tabBalances.classList.add('border-transparent', 'text-gray-500');
            this.loadExpenses();
        } else {
            expensesContainer.classList.add('hidden');
            balancesContainer.classList.remove('hidden');
            tabBalances.classList.add('border-indigo-600', 'text-indigo-600');
            tabBalances.classList.remove('border-transparent', 'text-gray-500');
            tabExpenses.classList.remove('border-indigo-600', 'text-indigo-600');
            tabExpenses.classList.add('border-transparent', 'text-gray-500');
            this.loadBalances();
        }
    },

    // --- API Interactions ---

    createGroup: async function () {
        const name = document.getElementById('new-group-name').value;
        const participantsStr = document.getElementById('new-group-participants').value;
        const currency = document.getElementById('new-group-currency').value;

        if (!name || !participantsStr) {
            alert('¡Por favor completa todos los campos! ⚠️');
            return;
        }

        const participants = participantsStr.split(',').map(p => p.trim()).filter(p => p);

        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, participants, currency })
            });
            const data = await response.json();

            // Clear inputs
            document.getElementById('new-group-name').value = '';
            document.getElementById('new-group-participants').value = '';

            this.showGroupView(data.id);
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Error al crear el grupo ❌');
        }
    },

    loadRecentGroups: async function () {
        const container = document.getElementById('recent-groups');
        const list = document.getElementById('groups-list');

        try {
            const response = await fetch('/api/groups');
            const groups = await response.json();

            if (groups.length > 0) {
                container.classList.remove('hidden');
                list.innerHTML = '';

                groups.forEach(group => {
                    const div = document.createElement('div');
                    div.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer flex justify-between items-center dark:bg-gray-800 dark:border-gray-700 dark:hover:shadow-lg';
                    div.onclick = () => this.showGroupView(group.id);
                    div.innerHTML = `
                        <div>
                            <h4 class="font-bold text-gray-900 dark:text-gray-100">${group.name}</h4>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Creado el ${new Date(group.created_at).toLocaleDateString()}</p>
                        </div>
                        <i class="fas fa-chevron-right text-gray-400 dark:text-gray-500"></i>
                    `;
                    list.appendChild(div);
                });
            } else {
                container.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    },

    loadGroupData: async function (groupId) {
        try {
            const response = await fetch(`/api/groups/${groupId}`);
            const data = await response.json();

            this.participants = data.participants;
            this.currentGroupCurrency = data.group.currency;

            const currencySymbol = this.getCurrencySymbol(this.currentGroupCurrency);
            document.getElementById('group-title').innerText = `${data.group.name} (${this.currentGroupCurrency})`; // Show currency in title
            document.getElementById('participant-count').innerText = this.participants.length;

            // Populate Payer Select and Involved Checkboxes for Modal
            const payerSelect = document.getElementById('expense-payer');
            const involvedDiv = document.getElementById('expense-involved');

            payerSelect.innerHTML = '';
            involvedDiv.innerHTML = '';

            this.participants.forEach(p => {
                // Option
                const option = document.createElement('option');
                option.value = p.id;
                option.innerText = p.name;
                payerSelect.appendChild(option);

                // Checkbox
                const label = document.createElement('label');
                label.className = 'flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer';
                label.innerHTML = `
                    <input type="checkbox" value="${p.id}" checked class="form-checkbox h-4 w-4 text-indigo-600 rounded">
                    <span>${p.name}</span>
                `;
                involvedDiv.appendChild(label);
            });

        } catch (error) {
            console.error('Error loading group:', error);
        }
    },

    loadExpenses: async function () {
        const container = document.getElementById('expenses-container');
        container.innerHTML = '<div class="text-center text-gray-500 py-8">Cargando... ⏳</div>';

        try {
            const response = await fetch(`/api/groups/${this.currentGroupId}/expenses`);
            const expenses = await response.json();

            container.innerHTML = '';

            if (expenses.length === 0) {
                container.innerHTML = '<div class="text-center text-gray-400 py-8">¡Aún no hay gastos! Agrega uno. ➕</div>';
                return;
            }

            expenses.forEach(expense => {
                const payer = this.participants.find(p => p.id === expense.payer_id);
                const date = new Date(expense.created_at).toLocaleDateString();

                const div = document.createElement('div');
                div.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center dark:bg-gray-800 dark:border-gray-700';
                div.innerHTML = `
                    <div class="flex items-center space-x-4">
                        <div class="bg-indigo-100 text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm dark:bg-indigo-900 dark:text-indigo-200">
                            ${date.split('/')[0]}/${date.split('/')[1]}
                        </div>
                        <div>
                            <h4 class="font-semibold text-gray-900 dark:text-gray-100">${expense.title}</h4>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${payer ? payer.name : 'Desconocido'} pagó ${this.getCurrencySymbol(this.currentGroupCurrency)}${expense.amount.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="block font-bold text-gray-900 dark:text-gray-100">${this.getCurrencySymbol(this.currentGroupCurrency)}${expense.amount.toFixed(2)}</span>
                    </div>
                `;
                container.appendChild(div);
            });
        } catch (error) {
            console.error('Error loading expenses:', error);
            container.innerHTML = '<div class="text-red-500 text-center">Error cargando gastos ❌</div>';
        }
    },

    loadBalances: async function () {
        const container = document.getElementById('balances-container');
        container.innerHTML = '<div class="text-center text-gray-500 py-8">Calculando... 🧮</div>';

        try {
            const response = await fetch(`/api/groups/${this.currentGroupId}/balance`);
            const data = await response.json();

            container.innerHTML = '';

            // 1. Settlements Section
            const settlementsDiv = document.createElement('div');
            settlementsDiv.innerHTML = '<h3 class="text-lg font-semibold mb-3 text-gray-800">Cómo Saldar Deudas 🤝</h3>';

            if (data.settlements.length === 0) {
                settlementsDiv.innerHTML += '<p class="text-gray-500 italic dark:text-gray-400">¡Todos están a mano! 🎉</p>';
            } else {
                const list = document.createElement('ul');
                list.className = 'space-y-3';
                data.settlements.forEach(s => {
                    const from = this.participants.find(p => p.id === s.from);
                    const to = this.participants.find(p => p.id === s.to);

                    const li = document.createElement('li');
                    li.className = 'flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-100 dark:bg-green-900/30 dark:border-green-800';
                    li.innerHTML = `
                        <div class="flex items-center">
                            <span class="font-medium text-gray-900 dark:text-gray-100">${from.name}</span>
                            <i class="fas fa-arrow-right mx-3 text-green-400"></i>
                            <span class="font-medium text-gray-900 dark:text-gray-100">${to.name}</span>
                        </div>
                        <span class="font-bold text-green-700 dark:text-green-400">${this.getCurrencySymbol(this.currentGroupCurrency)}${s.amount.toFixed(2)}</span>
                    `;
                    list.appendChild(li);
                });
                settlementsDiv.appendChild(list);
            }
            container.appendChild(settlementsDiv);

            // 2. Full Balances
            const balancesDiv = document.createElement('div');
            balancesDiv.className = 'mt-8 pt-6 border-t border-gray-200';
            balancesDiv.innerHTML = '<h3 class="text-sm font-semibold mb-3 text-gray-500 uppercase tracking-wider">Saldos Netos 📊</h3>';

            const balanceList = document.createElement('div');
            balanceList.className = 'grid grid-cols-2 gap-4';

            for (const [pid, amount] of Object.entries(data.balances)) {
                const p = this.participants.find(part => part.id == pid);
                if (!p) continue;

                const isPositive = amount > 0;
                const colorClass = isPositive ? 'text-green-600' : (amount < 0 ? 'text-red-600' : 'text-gray-400');
                const sign = isPositive ? '+' : '';

                const item = document.createElement('div');
                item.className = 'bg-white p-3 rounded border border-gray-100 text-center dark:bg-gray-800 dark:border-gray-700';
                item.innerHTML = `
                    <div class="font-medium text-gray-900 dark:text-gray-100">${p.name}</div>
                    <div class="text-sm font-bold ${colorClass}">${sign}${this.getCurrencySymbol(this.currentGroupCurrency)}${amount.toFixed(2)}</div>
                `;
                balanceList.appendChild(item);
            }
            balancesDiv.appendChild(balanceList);
            container.appendChild(balancesDiv);

        } catch (error) {
            console.error('Error loading balances:', error);
            container.innerHTML = '<div class="text-red-500 text-center">Error cargando saldos ❌</div>';
        }
    },

    // --- Actions ---

    toggleAddExpenseModal: function () {
        const modal = document.getElementById('modal-add-expense');
        modal.classList.toggle('hidden');
        modal.classList.toggle('flex');
    },

    addExpense: async function () {
        const title = document.getElementById('expense-title').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const payerId = document.getElementById('expense-payer').value;

        // Get checked involved participants
        const checkboxes = document.querySelectorAll('#expense-involved input[type="checkbox"]:checked');
        const involvedIds = Array.from(checkboxes).map(cb => cb.value);

        if (!title || isNaN(amount) || !payerId || involvedIds.length === 0) {
            alert('¡Por favor completa todos los campos y selecciona al menos un participante! ⚠️');
            return;
        }

        try {
            const response = await fetch(`/api/groups/${this.currentGroupId}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    amount,
                    payer_id: payerId,
                    involved_ids: involvedIds
                })
            });

            if (response.ok) {
                this.toggleAddExpenseModal();
                // Reset form
                document.getElementById('expense-title').value = '';
                document.getElementById('expense-amount').value = '';
                this.loadExpenses(); // Refresh list
            } else {
                alert('Error al agregar gasto ❌');
            }
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('Error al agregar gasto ❌');
        }
    },

    // --- Profile Logic ---
    toggleUserMenu: function () {
        const menu = document.getElementById('user-dropdown');
        menu.classList.toggle('hidden');
    },

    updateProfile: async function () {
        const name = document.getElementById('profile-name').value;
        const currentPassword = document.getElementById('profile-current-password').value;
        const newPassword = document.getElementById('profile-new-password').value;

        const payload = { name };
        if (currentPassword && newPassword) {
            payload.current_password = currentPassword;
            payload.new_password = newPassword;
        }

        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                alert('Perfil actualizado con éxito ✅');
                this.currentUser.name = data.name;
                document.getElementById('user-display-name').innerText = data.name;

                // Clear password inputs
                document.getElementById('profile-current-password').value = '';
                document.getElementById('profile-new-password').value = '';
            } else {
                alert(data.error || 'Error al actualizar perfil ❌');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Error al actualizar perfil ❌');
        }
    },

    uploadAvatar: async function (input) {
        if (input.files && input.files[0]) {
            const formData = new FormData();
            formData.append('avatar', input.files[0]);

            try {
                const response = await fetch('/api/user/avatar', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    // Update avatrs in UI
                    this.currentUser.avatar_path = data.avatar_path;
                    document.getElementById('nav-user-avatar').src = data.avatar_path;
                    document.getElementById('profile-avatar').src = data.avatar_path;
                } else {
                    alert(data.error || 'Error al subir imagen ❌');
                }
            } catch (error) {
                console.error('Error uploading avatar:', error);
                alert('Error al subir imagen ❌');
            }
        }
    },

    getCurrencySymbol: function (currencyCode) {
        const symbols = {
            'USD': '$',
            'EUR': '€',
            'ARS': '$',
            'MXN': '$',
            'COP': '$',
            'CLP': '$',
            'GTQ': 'Q'
        };
        return symbols[currencyCode] || '$';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
