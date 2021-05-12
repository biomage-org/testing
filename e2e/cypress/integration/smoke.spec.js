context('Smoke Test', () => {

    const EXPERIMENT_ID = Cypress.env('EXPERIMENT_ID') ?? 'e52b39624588791a7889e39c617f669e';
    const GENE_IN_TOOLS = Cypress.env('GENE_IN_TOOLS') ?? 'Lyz2';

    const getPipelineApiUrl = () => {
      const baseUrl = Cypress.config().baseUrl;
      let server = 'http://localhost:3000';
      if (!baseUrl.startsWith('http://localhost')) {
        server = baseUrl.replace('//ui-', '//api-') ;
      }
      return `${server}/v1/experiments/${EXPERIMENT_ID}/pipelines`;
    };

    const startPipelineViaApi = () => {
      const url = getPipelineApiUrl(); 
      cy.log(`Starting pipeline by POSTing to ${url}`);
      cy.request('POST', url, {});
    };
    
    const startPipelineViaUI = () => {
      // Verify that the first filter is disabled by prefiltered samples, and move past it
      // cy.get('[role=alert]')
      //   .should('contain.text', 'pre-filtered');
      cy.get('[data-testid=enableFilterButton]')
        .should('not.be.enabled');
      cy.get('[data-testid=pipelineNextStep]').click();

      // Enable+disable+save changes to trigger the pipeline
      cy.get('[data-testid=enableFilterButton]').click();
      cy.get('[data-testid=enableFilterButton]').click();
      cy.get('[data-testid=runFilterButton]').click();
    };

    const testDataProcessing = () => {
      cy.visit(`/experiments/${EXPERIMENT_ID}/data-processing`);

      const useApi = true;

      if (useApi) {
        startPipelineViaApi();
      } else {
        startPipelineViaUI();
      }
    
      const numSteps = 7;
      const stepTimeOut = 60 * 1000;
      const oneStepTimeout = { timeout: stepTimeOut };
      const restOfStepsTimeout = { timeout: stepTimeOut * (numSteps - 1) };
      
      // Wait for the pipeline to start.
      // Starting the pipeline can result in us getting in a skeleton state,
      // so we need a higher timeout also to get the progressbar
      cy.get('[role=progressbar]', oneStepTimeout) 
        .invoke(oneStepTimeout, 'attr', 'aria-valuenow')
        .should('equal', '1');
      // Wait for the pipeline to complete
      cy.get('[role=progressbar]', )
        .invoke(restOfStepsTimeout, 'attr', 'aria-valuenow')
        .should('equal', `${numSteps}`);
    };

    const testDataExploration = () => {
      
      cy.visit(`/experiments/${EXPERIMENT_ID}/data-exploration`);
      const dataExplorationTimeOut = { timeout: 40 * 1000 };

      // The clusters are loaded
      // Mosaic is not very testing friendly :-(
      cy.get('.mosaic-window', dataExplorationTimeOut)
        .should('contain.text', 'Data Management')
        .and('contain.text', 'Cluster 1')

      // The list of gens is loaded so that we know that the worker has done something
      const maxRetryAttempts = 3;
      cy.get('.mosaic-window', dataExplorationTimeOut)
        .contains('Tools')
        .then(($toolsTitle) => {
          const $tools = $toolsTitle.parent().parent();
          const verifyGeneDisplayed = () => {
            cy.wrap($tools).should('contain.text', GENE_IN_TOOLS);
          };
          const waitForWaitingBannerToGoAway = (callBack) => {
            cy.wrap($tools, dataExplorationTimeOut)
              .should('not.contain', 'getting your data')
              .then(callBack);

          };
          const clickOnRetyButton = () => {
            cy.wrap($tools)
              .contains('button', /try again/i)
              .click();
          };
          let attempts = 0;
          function checkAndRetry() {
            // synchronous queries, using jQuery
            const tryAgainButton = $tools.find(':contains("Try again")');
            const waitingBanner = $tools.find(':contains("getting your data")');
            attempts += 1;
            if (tryAgainButton.length) {
              attempts += 1;
              if (attempts > maxRetryAttempts) {
                throw new Error('Number of retry attemps exceeded. Is there something wrong with the worker?');
              }
              clickOnRetyButton();
              cy.wait(100).then(checkAndRetry);
            } else if (waitingBanner.length) {
              waitForWaitingBannerToGoAway(checkAndRetry);
            } else {
              verifyGeneDisplayed();
            }
          }
          checkAndRetry();
        });
    };
    
    it.only('runs the pipeline and can move to data exploration', () => {

      testDataProcessing();
      testDataExploration();

    })
  })
  