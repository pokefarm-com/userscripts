(function () {
    "use strict";

    // Check if we're on a supported page
    if (!/^\/shinyhunt/.test(location.pathname)) return;

    const scriptName = 'lunex';
    let apiClient;
    let config;
    let dex;

    async function waitForDependencies(callback, tries = 0) {
        // Check if both dependencies are available
        if (typeof PFQAPI === 'function' && typeof PersistentConfig === 'function') {
            await callback();
        } else {
            if (tries > 100) {
                console.error('PFQAPI or PersistentConfig never became available.');
                return false;
            }
            setTimeout(() => waitForDependencies(callback, tries + 1), 200);
            return;
        }
        return true;
    }

    function createModernChainsUI() {
        // Remove the old UI
        const oldList = document.getElementById('savedprchains');
        if (oldList) {
            oldList.remove();
        }

        // Create container for the new UI
        const container = document.createElement('div');
        container.id = 'modern-chains-container';
        container.style.cssText = `
            margin: 20px 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Create search and filter bar
        const searchBar = document.createElement('div');
        searchBar.style.cssText = `
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            align-items: center;
            flex-wrap: wrap;
        `;

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search Pokémon...';
        searchInput.style.cssText = `
            flex: 1;
            min-width: 200px;
            padding: 10px 15px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        `;
        searchInput.addEventListener('focus', () => {
            searchInput.style.borderColor = '#007bff';
        });
        searchInput.addEventListener('blur', () => {
            searchInput.style.borderColor = '#e1e5e9';
        });

        const sortSelect = document.createElement('select');
        sortSelect.style.cssText = `
            padding: 10px 15px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 14px;
            background: white;
            cursor: pointer;
            outline: none;
        `;
        sortSelect.innerHTML = `
            <option value="name">Sort by Name</option>
            <option value="chain">Sort by Chain Length</option>
            <option value="successes">Sort by Successes</option>
            <option value="date">Sort by Date</option>
        `;

        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 Refresh';
        refreshBtn.style.cssText = `
            padding: 10px 15px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        `;
        refreshBtn.addEventListener('mouseenter', () => {
            refreshBtn.style.background = '#0056b3';
        });
        refreshBtn.addEventListener('mouseleave', () => {
            refreshBtn.style.background = '#007bff';
        });

        searchBar.appendChild(searchInput);
        searchBar.appendChild(sortSelect);
        searchBar.appendChild(refreshBtn);

        // Create chains grid
        const chainsGrid = document.createElement('div');
        chainsGrid.id = 'chains-grid';
        chainsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 20px;
        `;

        // Create loading state
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'chains-loading';
        loadingDiv.textContent = 'Loading saved chains...';
        loadingDiv.style.cssText = `
            text-align: center;
            padding: 40px;
            color: #666;
            font-size: 16px;
        `;

        container.appendChild(searchBar);
        container.appendChild(loadingDiv);
        container.appendChild(chainsGrid);

        // Insert the new UI after the shinyhuntradar div
        const radarDiv = document.getElementById('shinyhuntradar');
        if (radarDiv) {
            radarDiv.parentNode.insertBefore(container, radarDiv.nextSibling);
        }

        // Store references for later use
        window.lunexUI = {
            searchInput,
            sortSelect,
            refreshBtn,
            chainsGrid,
            loadingDiv,
            container
        };

        return container;
    }

    function createChainCard(chain, pokemon) {
        const card = document.createElement('div');
        card.className = 'chain-card';
        card.style.cssText = `
            background: white;
            border: 1px solid #e1e5e9;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
        `;

        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        });

        // Calculate progress percentage
        const progressPercent = pokemon ? (chain.successes / pokemon.chain) * 100 : 0;
        const progressColor = progressPercent >= 100 ? '#28a745' : 
                             progressPercent >= 50 ? '#ffc107' : '#dc3545';

        // Format date
        const savedDate = new Date(chain.saved_at);
        const dateStr = savedDate.toLocaleDateString() + ' ' + savedDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <img src="${pokemon ? pokemon.sprite : 'https://r2.pokefarm.com/img/pkmn/j/t/s/h.png'}" 
                     alt="${pokemon ? pokemon.name : 'Unknown'}" 
                     style="width: 48px; height: 48px; border-radius: 8px;">
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #333;">
                        ${pokemon ? pokemon.name : 'Unknown Pokémon'}
                    </h3>
                    <p style="margin: 0; color: #666; font-size: 14px;">
                        Chain: ${chain.chain.toLocaleString()} | Successes: ${chain.successes}
                    </p>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; color: #666;">
                    <span>Progress</span>
                    <span>${chain.successes}/${chain.chain} (${progressPercent.toFixed(1)}%)</span>
                </div>
                <div style="width: 100%; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${Math.min(progressPercent, 100)}%; height: 100%; background: ${progressColor}; transition: width 0.3s;"></div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #999;">Saved: ${dateStr}</span>
                <button class="resume-btn" data-restore="${chain.chain}" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background-color 0.2s;
                ">Resume</button>
            </div>
        `;

        // Add click handler for resume button
        const resumeBtn = card.querySelector('.resume-btn');
        resumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Trigger the original resume functionality
            const originalBtn = document.querySelector(`button[data-restore="${chain.chain}"]`);
            if (originalBtn) {
                originalBtn.click();
            }
        });

        resumeBtn.addEventListener('mouseenter', () => {
            resumeBtn.style.background = '#0056b3';
        });

        resumeBtn.addEventListener('mouseleave', () => {
            resumeBtn.style.background = '#007bff';
        });

        return card;
    }

    async function loadAndDisplayChains() {
        try {
            window.lunexUI.loadingDiv.style.display = 'block';
            window.lunexUI.chainsGrid.innerHTML = '';

            const chains = await apiClient.chains();
            const searchTerm = window.lunexUI.searchInput.value.toLowerCase();
            const sortBy = window.lunexUI.sortSelect.value;

            // Filter chains based on search term
            let filteredChains = chains.filter(chain => {
                if (!searchTerm) return true;
                const pokemon = dex.get(chain.formeid);
                return pokemon && pokemon.name.toLowerCase().includes(searchTerm);
            });

            // Sort chains
            filteredChains.sort((a, b) => {
                const pokemonA = dex.get(a.formeid);
                const pokemonB = dex.get(b.formeid);
                
                switch (sortBy) {
                    case 'name':
                        return (pokemonA?.name || '').localeCompare(pokemonB?.name || '');
                    case 'chain':
                        return b.chain - a.chain;
                    case 'successes':
                        return b.successes - a.successes;
                    case 'date':
                        return new Date(b.saved_at) - new Date(a.saved_at);
                    default:
                        return 0;
                }
            });

            // Create cards for each chain
            filteredChains.forEach(chain => {
                const pokemon = dex.get(chain.formeid);
                const card = createChainCard(chain, pokemon);
                window.lunexUI.chainsGrid.appendChild(card);
            });

            // Hide loading and show results
            window.lunexUI.loadingDiv.style.display = 'none';
            
            if (filteredChains.length === 0) {
                const noResults = document.createElement('div');
                noResults.textContent = searchTerm ? 'No chains found matching your search.' : 'No saved chains found.';
                noResults.style.cssText = `
                    text-align: center;
                    padding: 40px;
                    color: #666;
                    font-size: 16px;
                    grid-column: 1 / -1;
                `;
                window.lunexUI.chainsGrid.appendChild(noResults);
            }

        } catch (error) {
            console.error('Error loading chains:', error);
            window.lunexUI.loadingDiv.textContent = 'Error loading chains. Please try again.';
            window.lunexUI.loadingDiv.style.color = '#dc3545';
        }
    }

    function setupEventListeners() {
        // Search functionality
        window.lunexUI.searchInput.addEventListener('input', () => {
            loadAndDisplayChains();
        });

        // Sort functionality
        window.lunexUI.sortSelect.addEventListener('change', () => {
            loadAndDisplayChains();
        });

        // Refresh functionality
        window.lunexUI.refreshBtn.addEventListener('click', () => {
            loadAndDisplayChains();
        });
    }

    async function initializeModernUI() {
        // Create the modern UI
        createModernChainsUI();
        
        // Setup event listeners
        setupEventListeners();
        
        // Load initial data
        await loadAndDisplayChains();
    }

    window.addEventListener('load', () => {
        waitForDependencies(async () => {
            // Initialize both dependencies
            apiClient = new PFQAPI();
            config = await (new PersistentConfig(scriptName)).ready;
            dex = apiClient.dex;

            // Initialize the modern UI if on shinyhunt page
            if(location.pathname.startsWith('/shinyhunt')) {
                await initializeModernUI();
            }
        });
    });
})();