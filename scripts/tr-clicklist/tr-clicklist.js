(function () {
    "use strict";

    // Check if we're on a supported page
    if (!/^\/(users\/|typerace)/.test(location.pathname)) return;

    const scriptName = 'tr-clicklist';
    let apiClient;
    let config;
    let keydownListenerAdded = false;

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

    // Function to add clicklist link to type elements
    async function addClicklistLink() {
        const typeElements = document.querySelectorAll('.type');
        
        // If no type elements found, return early
        if (typeElements.length === 0) return;
        
        // Check if any element already has a clicklist link to avoid duplicates
        const existingLink = document.querySelector('.clicklist-link');
        if (existingLink) return;
        
        // Set page to 1 once and persist
        config.set("page", 1);
        config.persist();
        
        try {
            // Make a single API call for all elements
            const clicklist = await apiClient.typeraceClicklist(1);
            
            // Check if we have users in the clicklist
            if (!clicklist.users || clicklist.users.length === 0) {
                console.log('No users found in clicklist');
                return;
            }
            
            // Create the link URL once
            const linkUrl = `/users/:${clicklist.users.join(",:")}?src=${scriptName}`;

            // Only run on first element, as the second is Stellar Info
            const typeElement = typeElements[0];
            
            const dash = document.createTextNode(' - ');
            typeElement.appendChild(dash);
            
            const link = document.createElement('a');
            link.href = linkUrl;
            link.textContent = '[Clicklist]';
            link.className = 'clicklist-link';
            
            // Add click handler for first run dialog
            link.addEventListener('click', (e) => {
                if(config.get("firstRun") === true) {
                    e.preventDefault();
                    
                    const buttons = [];
                    buttons.push({ text: "Confirm", action: function() { window.location.href = link.href; }});

                    const contentHTML = `
                        <p>This will open your team's clicklist.</p>
                        <p>The clicklist is cached for 30 minutes, and does not check if you have already interacted with a user.</p>
                        <p>Only users of your team with a non-zero score will be shown.</p>
                        <p>Do not try to copy the link to this clicklist to share between other users, as it is dynamically generated every time this page is loaded (within the 30 minute cache).</p>
                        <p><strong>This message will not appear again.</strong></p>
                    `;

                    const dialog = new Dialog("Moonsy's TR-Clicklist script", contentHTML, buttons);

                    dialog.opened(function(d) {
                        config.set("firstRun", false);
                        config.persist();
                    });
                }
            });
            
            typeElement.appendChild(link);
        } catch (error) {
            console.error('Error loading clicklist:', error);
        }
    }

    // Function to handle clicklist navigation on user profile pages
    async function handleClicklistNavigation() {
        // Check if we're on a user profile page with clicklist source
        if (!location.pathname.startsWith('/users/') || !location.search.includes('src=tr-clicklist')) {
            return;
        }

        // Function to enable clicklist navigation on a disabled next button
        function enableClicklistNavigation(nextButton) {
            // Prevent multiple event listeners
            if (nextButton.hasAttribute('data-clicklist-enabled')) {
                return;
            }

            // Mark as enabled
            nextButton.setAttribute('data-clicklist-enabled', 'true');

            // Enable the button
            nextButton.classList.remove('disabled');
            nextButton.href = '#';
            nextButton.textContent = 'Get more +';
            nextButton.setAttribute('next-page', 'true');

            // Add click handler for next page navigation
            nextButton.addEventListener('click', async (e) => {
                e.preventDefault();
                
                nextButton.classList.add('disabled');
                nextButton.textContent = 'Loading...';

                const currentPage = config.get("page");
                const nextPage = currentPage + 1;
                
                try {
                    // Get the next page of clicklist
                    const nextClicklist = await apiClient.typeraceClicklist(nextPage);
                    
                    // Check if the next page has users
                    if (nextClicklist.users && nextClicklist.users.length > 0) {
                        // Update config and persist
                        config.set("page", nextPage);
                        config.persist();
                        
                        // Navigate to the next page
                        const nextUrl = `/users/:${nextClicklist.users.join(",:")}?src=${scriptName}`;

                        // Add 3 second delay before navigation to ensure interactions have been processed
                        setTimeout(() => {
                            window.location.href = nextUrl;
                        }, 3000);
                    } else {
                        // Next page is empty, leave button disabled
                        nextButton.classList.add('disabled');

                        nextButton.textContent = 'No more users';
                        config.set("page", 1);
                        config.persist();
                    }
                } catch (error) {
                    console.error('Error loading next clicklist page:', error);
                    // On error, leave button disabled
                    nextButton.classList.add('disabled');
                }
            });

            // Only add keydown listener once globally
            if (!keydownListenerAdded) {
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowRight' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        // Check if the next button is enabled and visible
                        const nextButton = document.querySelector('a.mu_navlink.next');
                        if (nextButton && !nextButton.classList.contains('disabled') && 
                            nextButton.offsetParent !== null) { // Check if visible
                            e.preventDefault();
                            nextButton.click();
                        }
                    }
                });
                keydownListenerAdded = true;
            }
        }

        // Function to check and setup the next button
        function checkNextButton() {
            const nextButton = document.querySelector('a.mu_navlink.next');

            if (nextButton) {
                // Check if accessibleinteractions is currently running by looking for disabled autofeed button
                const autofeedButton = document.getElementById('autofeed-button');
                const isAccessibleInteractionsRunning = autofeedButton && autofeedButton.disabled;
                
                // Only enable clicklist navigation if button is disabled AND accessibleinteractions is not running
                if (nextButton.classList.contains('disabled') && !isAccessibleInteractionsRunning) {
                    enableClicklistNavigation(nextButton);
                }
            }
        }

        // Watch for changes to the DOM that might affect the next button
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            mutations.forEach((mutation) => {
                // Check if the mutation affects elements that might contain the next button
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if the added node is the next button or contains it
                            if (node.matches && node.matches('a.mu_navlink.next')) {
                                shouldCheck = true;
                            } else if (node.querySelector && node.querySelector('a.mu_navlink.next')) {
                                shouldCheck = true;
                            }
                        }
                    });
                } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Check if the changed element is the next button
                    if (mutation.target.matches && mutation.target.matches('a.mu_navlink.next')) {
                        shouldCheck = true;
                    }
                }
            });
            
            if (shouldCheck) {
                // Small delay to ensure DOM is fully updated
                setTimeout(checkNextButton, 50);
            }
        });

        // Observe the entire document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        // Initial check
        checkNextButton();
    }

    window.addEventListener('load', () => {
        waitForDependencies(async () => {
            // Initialize both dependencies
            apiClient = new PFQAPI();
            config = await (new PersistentConfig(scriptName)).ready;
            
            // Set default page if not already set
            if(config.get("page") === undefined) {
                config.set("page", 1);
                config.persist();
            }

            if(config.get("firstRun") === undefined) {
                config.set("firstRun", true);
                config.persist();
            }
            
            // Add clicklist link if on typerace page
            if(location.pathname.startsWith('/typerace')) {
                addClicklistLink();
            }
            
            // Handle clicklist navigation if on user profile page
            if(location.pathname.startsWith('/users/')) {
                handleClicklistNavigation();
            }
        });
    });

})();