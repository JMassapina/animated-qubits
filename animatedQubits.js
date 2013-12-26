/* global define, module, require */

(function (globals) {
    "use strict";
    
    var createModule = function (_, Q, rendererFactory, calculatorFactory) {

        var ensureDependenciesAreSet = function () {
            _ = _ || globals._;
            Q = Q || globals.Q;
            rendererFactory = rendererFactory || globals.animatedQubitsInternal.rendererFactory;
            calculatorFactory = calculatorFactory || globals.animatedQubitsInternal.calculatorFactory;
        };
    
        return function (qstate, config) {
            ensureDependenciesAreSet();
            var stateComponents,
                numBits = qstate.numBits(),
                renderer,
                calculator = calculatorFactory(config),
                currentOperationPromise = Q.when();

            var phase1 = function (newStateComponents) {
                return renderer.renderState(newStateComponents, {duration: 0});
            };
            
            var phase2 = function (phases, newStateComponents) {
                return function () {
                    var promise = Q.when();
                    phases.stateComponentIndexesGroupedBySource.forEach(function(indexGroup) {
                        promise = promise.then(phase2a(phases, newStateComponents, indexGroup))
                            .then(phase2b(phases, newStateComponents, indexGroup));
                    });
                    return promise;
                };
            };
            
            var phase2a = function (phases, newStateComponents, indexGroup) {
                return function () {
                    indexGroup.forEach(function(index) {
                        var key = newStateComponents[index].key;
                        newStateComponents[index] = phases.phase2a[key];
                    });
                    return renderer.renderState(newStateComponents, {duration: 0});
                };
            };
            
            var phase2b = function (phases, newStateComponents, indexGroup) {
                return function () {
                    indexGroup.forEach(function(index) {
                        var key = newStateComponents[index].key;
                        newStateComponents[index] = phases.phase2b[key];
                    });
                    return renderer.renderState(newStateComponents);
                };
            };
            
            var phase3 = function name(phases) {
                return renderer.renderState.bind(null, phases.phase3);
            };
            
            var phase4 = function name(phases) {
                return renderer.renderState.bind(null, phases.phase4, {duration: 0});
            };
            
            var phase5 = function name(phases) {
                return renderer.renderState.bind(null, phases.phase5);
            };
            
            var applyOperation = function (operation, options) {
                var phases = calculator.createPhases(stateComponents, operation),
                    newStateComponents = phases.phase1.map(_.clone),
                    newQState = operation(qstate),
                    phase5Promise;

                qstate = newQState;
                stateComponents = calculator.augmentState(qstate);
                
                if (options && options.skipInterferenceSteps) {
                    phase5Promise = phase1(newStateComponents).then(phase5(phases));
                } else {
                    phase5Promise = phase1(newStateComponents)
                        .then(phase2(phases, newStateComponents))
                        .then(phase3(phases))
                        .then(phase4(phases))
                        .then(phase5(phases));
                }
                
                return phase5Promise.then(function returnNewQState() {
                    return newQState;
                });
            };
            
            var performInitialRendering = function () {
                // This should probably move to renderer itself.
                renderer.updateDimensions();
                renderer.renderBitLabels();
                renderer.renderStateLabels();
                stateComponents = calculator.augmentState(qstate);
                return renderer.renderState(stateComponents, {duration: 0});
            };

            return {
                display: function (svgElement) {
                    renderer = rendererFactory({
                        element: svgElement,
                        numBits: numBits,
                        maxRadius: config.maxRadius
                    });
                    return performInitialRendering();
                },
                resetQState: function (newQState) {
                    currentOperationPromise = currentOperationPromise.then(function () {
                        qstate = newQState;
                        numBits = qstate.numBits();
                        renderer.updateNumBits(numBits);
                        return performInitialRendering();
                    });
                    return currentOperationPromise;
                },
                applyOperation: function (operation, options) {
                    currentOperationPromise = currentOperationPromise.then(function () {
                        return applyOperation(operation, options);
                    });
                    return currentOperationPromise;
                }
            };
        };
    };

    /* Support AMD and CommonJS, with a fallback of putting animatedQubits in the global namespace */
    if (typeof define !== 'undefined' && define.amd) {
        define(['lodash', 'q', 'animatedQubitsRenderer', 'qubitAnimationCalculator'], createModule);
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = createModule(
            require('lodash'),
            require('q'),
            require('./lib/animatedQubitsRenderer'),
            require('./lib/qubitAnimationCalculator'));
    } else {
        globals.animatedQubits = createModule();
    }


})(this);