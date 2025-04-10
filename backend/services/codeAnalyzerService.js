const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const path = require('path');
const JSON5 = require('json5');
class CodeAnalyzerService {
    constructor() {
        this.parserOptions = {
            sourceType: 'module',
            plugins: ['jsx', 'typescript', 'decorators-legacy'],
        };
        // Bind methods to instance
        this.calculateFunctionComplexity = this.calculateFunctionComplexity.bind(this);
        this.calculateMaintainabilityIndex = this.calculateMaintainabilityIndex.bind(this);
        this.calculatePythonFunctionComplexity = this.calculatePythonFunctionComplexity.bind(this);
        this.calculatePythonClassComplexity = this.calculatePythonClassComplexity.bind(this);
    }

    async analyzeFile(filePath, content) {
        try {
            const fileExt = path.extname(filePath).toLowerCase();
            console.log(`Analyzing file: ${filePath} with extension ${fileExt}`);
            
            // Handle Python files
            if (['.py', '.pyw', '.pyi'].includes(fileExt)) {
                return this.analyzePythonFile(filePath, content);
            }
            
            // Handle JavaScript/TypeScript files
            if (['.js', '.jsx', '.ts', '.tsx'].includes(fileExt)) {
                return this.analyzeJavaScriptFile(filePath, content);
            }

            // Handle HTML files
            if (['.html', '.htm'].includes(fileExt)) {
                return this.analyzeHtmlFile(filePath, content);
            }

            // Handle CSS files
            if (['.css', '.scss', '.sass', '.less'].includes(fileExt)) {
                return this.analyzeCssFile(filePath, content);
            }

            // Handle JSON files
            if (fileExt === '.json') {
                return this.analyzeJsonFile(filePath, content);
            }

            // Handle Markdown files
            if (fileExt === '.md') {
                return this.analyzeMarkdownFile(filePath, content);
            }

            // For other file types, return basic analysis
            console.log(`Basic analysis for file: ${filePath}`);
            return {
                filePath: path.relative(process.cwd(), filePath),
                analysis: {
                    imports: [],
                    exports: [],
                    functions: [],
                    classes: [],
                    dependencies: new Set(),
                    metrics: {
                        linesOfCode: content.split('\n').length,
                        complexity: 0,
                        maintainability: 0
                    },
                    patterns: [],
                    issues: []
                }
            };
        } catch (error) {
            console.error(`Error analyzing file ${filePath}:`, error);
            return {
                filePath: path.relative(process.cwd(), filePath),
                analysis: {
                    imports: [],
                    exports: [],
                    functions: [],
                    classes: [],
                    dependencies: new Set(),
                    metrics: {
                        linesOfCode: 0,
                        complexity: 0,
                        maintainability: 0
                    },
                    patterns: [],
                    issues: [{
                        type: 'Analysis Error',
                        severity: 'error',
                        message: error.message
                    }]
                }
            };
        }
    }

    async analyzeJavaScriptFile(filePath, content) {
        try {
            const ast = parser.parse(content, this.parserOptions);
            const analysis = {
                imports: [],
                exports: [],
                functions: [],
                classes: [],
                dependencies: new Set(),
                metrics: {
                    linesOfCode: content.split('\n').length,
                    complexity: 0,
                    maintainability: 0
                },
                patterns: [],
                issues: []
            };

            let complexity = 0;
            let maintainability = 0;

            traverse(ast, {
                ImportDeclaration(path) {
                    analysis.imports.push({ 
                        source: path.node.source.value,
                        specifiers: path.node.specifiers.map(spec => ({
                            type: spec.type,
                            name: spec.local.name,
                        })),
                    });
                    analysis.dependencies.add(path.node.source.value);
                    
                },
                ExportNamedDeclaration(path) {
                    if (path.node.declaration) {
                        analysis.exports.push({
                            type: path.node.declaration.type,
                            name: path.node.declaration.id?.name,
                        });
                    }
                },
                FunctionDeclaration: (path) => {
                    if (path.node.id) {
                        const functionAnalysis = {
                            name: path.node.id.name,
                            params: path.node.params.map(param => param.name),
                            async: path.node.async,
                            complexity: this.calculateFunctionComplexity(path.node),
                            lines: path.node.loc ? path.node.loc.end.line - path.node.loc.start.line : 0
                        };
                        analysis.functions.push(functionAnalysis);
                        complexity += functionAnalysis.complexity;
                    }
                },
                ClassDeclaration: (path) => {
                    if (path.node.id) {
                        const classAnalysis = {
                            name: path.node.id.name,
                            methods: path.node.body.body
                                .filter(node => node.type === 'ClassMethod')
                                .map(method => ({
                                    name: method.key.name,
                                    static: method.static,
                                    async: method.async,
                                    complexity: this.calculateFunctionComplexity(method),
                                    lines: method.loc ? method.loc.end.line - method.loc.start.line : 0
                                })),
                            inheritance: path.node.superClass ? {
                                parent: path.node.superClass.name,
                                interfaces: path.node.implements ? path.node.implements.map(i => i.name) : []
                            } : null
                        };
                        analysis.classes.push(classAnalysis);
                        complexity += classAnalysis.methods.reduce((acc, m) => acc + m.complexity, 0);
                    }
                },
                // Detect design patterns
                CallExpression(path) {
                    if (path.node.callee.name === 'require') {
                        analysis.patterns.push({
                            type: 'Module Pattern',
                            location: path.node.loc
                        });
                    }
                },
                // Detect potential issues
                IfStatement(path) {
                    if (path.node.alternate && path.node.alternate.type === 'IfStatement') {
                        analysis.issues.push({
                            type: 'Nested If Statements',
                            severity: 'warning',
                            location: path.node.loc
                        });
                    }
                }
            });

            // Calculate maintainability index
            maintainability = this.calculateMaintainabilityIndex(
                analysis.metrics.linesOfCode,
                complexity,
                analysis.functions.length + analysis.classes.length
            );

            analysis.metrics.complexity = complexity;
            analysis.metrics.maintainability = maintainability;

            return {
                filePath: path.relative(process.cwd(), filePath),
                analysis,
            };
        } catch (error) {
            console.error(`Error analyzing JavaScript file ${filePath}:`, error);
            return {
                filePath: path.relative(process.cwd(), filePath),
                analysis: {
                    imports: [],
                    exports: [],
                    functions: [],
                    classes: [],
                    dependencies: new Set(),
                    metrics: {
                        linesOfCode: 0,
                        complexity: 0,
                        maintainability: 0
                    },
                    patterns: [],
                    issues: []
                }
            };
        }
    }

    calculateFunctionComplexity(node) {
        let complexity = 1; // Base complexity
        
        // Instead of using traverse, manually count complexity factors
        if (node.type === 'FunctionDeclaration' || node.type === 'ClassMethod') {
            // Count if statements
            if (node.body && node.body.body) {
                node.body.body.forEach(stmt => {
                    if (stmt.type === 'IfStatement') complexity += 1;
                    if (stmt.type === 'SwitchStatement') complexity += 1;
                    if (stmt.type === 'ForStatement') complexity += 2;
                    if (stmt.type === 'WhileStatement') complexity += 2;
                    if (stmt.type === 'DoWhileStatement') complexity += 2;
                    if (stmt.type === 'TryStatement') complexity += 1;
                    
                    // Check for logical expressions in conditions
                    if (stmt.type === 'IfStatement' && stmt.test && 
                        (stmt.test.type === 'LogicalExpression' || 
                         stmt.test.type === 'BinaryExpression')) {
                        complexity += 1;
                    }
                });
            }
        }
        
        return complexity;
    }

    calculateMaintainabilityIndex(linesOfCode, complexity, functionCount) {
        // Simplified maintainability index calculation
        const avgComplexity = complexity / (functionCount || 1);
        const avgLinesPerFunction = linesOfCode / (functionCount || 1);
        return Math.max(0, 100 - (avgComplexity * 10 + avgLinesPerFunction * 0.5));
    }

    async analyzePythonFile(filePath, content) {
        try {
            const lines = content.split('\n');
            const analysis = {
                imports: [],
                functions: [],
                classes: [],
                dependencies: new Set(),
                metrics: {
                    linesOfCode: lines.length,
                    complexity: 0,
                    maintainability: 0
                },
                patterns: [],
                issues: []
            };

            let complexity = 0;
            let currentFunction = null;
            let currentClass = null;

            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Analyze imports
                if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('from ')) {
                    const importMatch = trimmedLine.match(/^(?:from\s+([^\s]+)\s+)?import\s+(.+)$/);
                    if (importMatch) {
                        const module = importMatch[1] || importMatch[2].split()[0];
                        analysis.imports.push({
                            source: module,
                            specifiers: importMatch[2] ? importMatch[2].split(',') : [],
                        });
                        analysis.dependencies.add(module);
                    }
                }
                
                // Analyze function definitions
                const funcMatch = trimmedLine.match(/^def\s+(\w+)\s*\((.*)\)/);
                if (funcMatch) {
                    if (currentFunction) {
                        currentFunction.complexity = this.calculatePythonFunctionComplexity(currentFunction.lines);
                    }
                    currentFunction = {
                        name: funcMatch[1],
                        params: funcMatch[2].split(',').map(p => p.trim()),
                        lines: [],
                        complexity: 0
                    };
                    analysis.functions.push(currentFunction);
                }
                
                // Analyze class definitions
                const classMatch = trimmedLine.match(/^class\s+(\w+)/);
                if (classMatch) {
                    if (currentClass) {
                        currentClass.complexity = this.calculatePythonClassComplexity(currentClass.methods);
                    }
                    currentClass = {
                        name: classMatch[1],
                        methods: [],
                        complexity: 0
                    };
                    analysis.classes.push(currentClass);
                }

                // Collect lines for current function
                if (currentFunction) {
                    currentFunction.lines.push(trimmedLine);
                }

                // Detect patterns and issues
                if (trimmedLine.includes('if __name__ == "__main__":')) {
                    analysis.patterns.push({
                        type: 'Main Guard Pattern',
                        location: { line: lines.indexOf(line) + 1 }
                    });
                }

                if (trimmedLine.includes('except:')) {
                    analysis.issues.push({
                        type: 'Bare Except Clause',
                        severity: 'warning',
                        location: { line: lines.indexOf(line) + 1 }
                    });
                }
            }

            // Calculate final complexities
            if (currentFunction) {
                currentFunction.complexity = this.calculatePythonFunctionComplexity(currentFunction.lines);
            }
            if (currentClass) {
                currentClass.complexity = this.calculatePythonClassComplexity(currentClass.methods);
            }

            // Calculate total complexity
            complexity = analysis.functions.reduce((acc, f) => acc + f.complexity, 0) +
                        analysis.classes.reduce((acc, c) => acc + c.complexity, 0);

            // Calculate maintainability
            const maintainability = this.calculateMaintainabilityIndex(
                analysis.metrics.linesOfCode,
                complexity,
                analysis.functions.length + analysis.classes.length
            );

            analysis.metrics.complexity = complexity;
            analysis.metrics.maintainability = maintainability;

            return {
                filePath: path.relative(process.cwd(), filePath),
                analysis,
            };
        } catch (error) {
            console.error(`Error analyzing Python file ${filePath}:`, error);
            return {
                filePath: path.relative(process.cwd(), filePath),
                analysis: {
                    imports: [],
                    functions: [],
                    classes: [],
                    dependencies: new Set(),
                    metrics: {
                        linesOfCode: 0,
                        complexity: 0,
                        maintainability: 0
                    },
                    patterns: [],
                    issues: []
                }
            };
        }
    }

    calculatePythonFunctionComplexity(lines) {
        let complexity = 1;
        for (const line of lines) {
            if (line.includes('if ')) complexity += 1;
            if (line.includes('elif ')) complexity += 1;
            if (line.includes('for ')) complexity += 2;
            if (line.includes('while ')) complexity += 2;
            if (line.includes('except:')) complexity += 1;
            if (line.includes('and ') || line.includes('or ')) complexity += 1;
        }
        return complexity;
    }

    calculatePythonClassComplexity(methods) {
        return methods.reduce((acc, method) => acc + this.calculatePythonFunctionComplexity(method.lines), 0);
    }

    async generateSummary(analyses) {
        const summary = {
            totalFiles: analyses.length,
            totalFunctions: 0,
            totalClasses: 0,
            dependencies: new Set(),
            mainComponents: [],
            metrics: {
                totalLinesOfCode: 0,
                averageComplexity: 0,
                averageMaintainability: 0
            },
            patterns: [],
            issues: []
        };

        let totalComplexity = 0;
        let totalMaintainability = 0;

        for (const analysis of analyses) {
            if (!analysis) continue;

            summary.totalFunctions += analysis.analysis.functions.length;
            summary.totalClasses += analysis.analysis.classes.length;
            summary.metrics.totalLinesOfCode += analysis.analysis.metrics.linesOfCode;
            
            // Add all dependencies
            analysis.analysis.dependencies.forEach(dep => summary.dependencies.add(dep));

            // Collect patterns and issues
            summary.patterns.push(...analysis.analysis.patterns);
            summary.issues.push(...analysis.analysis.issues);

            // Add metrics
            totalComplexity += analysis.analysis.metrics.complexity;
            totalMaintainability += analysis.analysis.metrics.maintainability;

            // Identify main components (classes with significant methods)
            analysis.analysis.classes.forEach(cls => {
                if (cls.methods.length > 2) {
                    summary.mainComponents.push({
                        name: cls.name,
                        file: analysis.filePath,
                        methodCount: cls.methods.length,
                        complexity: cls.complexity
                    });
                }
            });
        }

        // Calculate averages
        summary.metrics.averageComplexity = totalComplexity / (summary.totalFunctions + summary.totalClasses || 1);
        summary.metrics.averageMaintainability = totalMaintainability / analyses.length;

        return {
            ...summary,
            dependencies: Array.from(summary.dependencies),
        };
    }

    analyzeHtmlFile(filePath, content) {
        const analysis = {
            imports: [],
            exports: [],
            functions: [],
            classes: [],
            dependencies: new Set(),
            metrics: {
                linesOfCode: content.split('\n').length,
                complexity: 0,
                maintainability: 0
            },
            patterns: [],
            issues: []
        };

        // Extract script and style dependencies
        const scriptMatches = content.match(/<script[^>]*src="([^"]*)"[^>]*>/g) || [];
        const styleMatches = content.match(/<link[^>]*href="([^"]*)"[^>]*>/g) || [];

        scriptMatches.forEach(match => {
            const src = match.match(/src="([^"]*)"/);
            if (src) analysis.dependencies.add(src[1]);
        });

        styleMatches.forEach(match => {
            const href = match.match(/href="([^"]*)"/);
            if (href) analysis.dependencies.add(href[1]);
        });

        return {
            filePath: path.relative(process.cwd(), filePath),
            analysis
        };
    }

    analyzeCssFile(filePath, content) {
        const analysis = {
            imports: [],
            exports: [],
            functions: [],
            classes: [],
            dependencies: new Set(),
            metrics: {
                linesOfCode: content.split('\n').length,
                complexity: 0,
                maintainability: 0
            },
            patterns: [],
            issues: []
        };

        // Extract @import statements
        const importMatches = content.match(/@import\s+['"]([^'"]+)['"]/g) || [];
        importMatches.forEach(match => {
            const url = match.match(/['"]([^'"]+)['"]/);
            if (url) analysis.dependencies.add(url[1]);
        });

        return {
            filePath: path.relative(process.cwd(), filePath),
            analysis
        };
    }

    analyzeJsonFile(filePath, content) {
        try {
            const json = JSON5.parse(content);
            const analysis = {
                imports: [],
                exports: [],
                functions: [],
                classes: [],
                dependencies: new Set(),
                metrics: {
                    linesOfCode: content.split('\n').length,
                    complexity: 0,
                    maintainability: 0
                },
                patterns: [],
                issues: []
            };

            // Extract dependencies from package.json
            if (path.basename(filePath) === 'package.json') {
                if (json.dependencies) {
                    Object.keys(json.dependencies).forEach(dep => analysis.dependencies.add(dep));
                }
                if (json.devDependencies) {
                    Object.keys(json.devDependencies).forEach(dep => analysis.dependencies.add(dep));
                }
            }

            return {
                filePath: path.relative(process.cwd(), filePath),
                analysis
            };
        } catch (error) {
            console.error(`Error parsing JSON file ${filePath}:`, error);
            return {
                filePath: path.relative(process.cwd(), filePath),
                analysis: {
                    imports: [],
                    exports: [],
                    functions: [],
                    classes: [],
                    dependencies: new Set(),
                    metrics: {
                        linesOfCode: content.split('\n').length,
                        complexity: 0,
                        maintainability: 0
                    },
                    patterns: [],
                    issues: [{
                        type: 'JSON Parse Error',
                        severity: 'error',
                        message: error.message
                    }]
                }
            };
        }
    }

    analyzeMarkdownFile(filePath, content) {
        const analysis = {
            imports: [],
            exports: [],
            functions: [],
            classes: [],
            dependencies: new Set(),
            metrics: {
                linesOfCode: content.split('\n').length,
                complexity: 0,
                maintainability: 0
            },
            patterns: [],
            issues: []
        };

        // Extract code blocks and links
        const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
        const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];

        links.forEach(link => {
            const url = link.match(/\(([^)]+)\)/);
            if (url) analysis.dependencies.add(url[1]);
        });

        return {
            filePath: path.relative(process.cwd(), filePath),
            analysis
        };
    }
}

module.exports = new CodeAnalyzerService(); 