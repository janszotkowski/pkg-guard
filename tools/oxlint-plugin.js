/**
 * Project lint rules that oxlint has no built-in rule for.
 *
 * `weighme/no-destructured-component-props`: a React component is an arrow function
 * assigned to a PascalCase const, and it takes ONE parameter named like any other
 * (`props: Props`) and reads `props.x`. Destructuring in the parameter list
 * (`({ error, reset }: Props) => …`) is not allowed. Destructuring from `props`
 * inside the body is fine when a component needs to forward the rest.
 *
 * `weighme/no-inline-component-props-type`: the props type is declared by name above the
 * component (`type CardProps = { … }`, `(props: CardProps) => …`), never written inline
 * in the parameter (`(props: { title: string }) => …`).
 */
/** `Card`, `CveList`, `UIButton`; not a SCREAMING_CASE constant (`MAX_ITEMS`, `API`) that happens to hold a function. */
const isPascalCase = (name) => /^[A-Z]/.test(name) && /[a-z]/.test(name);

const isFunction = (node) => node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';

const COMPONENT_WRAPPERS = new Set(['memo', 'forwardRef']);

/** `memo(…)`, `forwardRef(…)`, `React.memo(…)` or `React.forwardRef(…)`: other calls only return a value. */
const isComponentWrapper = (callee) =>
    (callee?.type === 'Identifier' && COMPONENT_WRAPPERS.has(callee.name)) ||
    (callee?.type === 'MemberExpression' &&
        !callee.computed &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'React' &&
        callee.property.type === 'Identifier' &&
        COMPONENT_WRAPPERS.has(callee.property.name));

/**
 * Calls `visit(name, fn)` for every component: `const Card = (…) => …`, `const Card = function (…) …`,
 * `const Card = memo((…) => …)` / `forwardRef(…)`, and `function Card(…) …`.
 */
const componentVisitors = (visit) => ({
    VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !isPascalCase(node.id.name)) return;
        const init = node.init;
        if (isFunction(init)) visit(node.id.name, init);
        else if (init?.type === 'CallExpression' && isComponentWrapper(init.callee) && isFunction(init.arguments[0])) visit(node.id.name, init.arguments[0]);
    },
    FunctionDeclaration(node) {
        if (node.id !== null && node.id !== undefined && isPascalCase(node.id.name)) visit(node.id.name, node);
    },
});

const rule = {
    meta: {
        type: 'suggestion',
        docs: { description: 'Components take `props: Props` and use `props.x`, never a destructured parameter list.' },
        schema: [],
    },
    create(context) {
        return componentVisitors((name, fn) => {
            for (const param of fn.params) {
                if (param.type === 'ObjectPattern' || (param.type === 'AssignmentPattern' && param.left.type === 'ObjectPattern')) {
                    context.report({
                        node: param,
                        message: `The component ${name} destructures its props in the parameter list. Take \`props: Props\` and use \`props.x\` instead.`,
                    });
                }
            }
        });
    },
};

const inlineTypeRule = {
    meta: {
        type: 'suggestion',
        docs: { description: 'Components declare their props as a named type, never as an inline object type.' },
        schema: [],
    },
    create(context) {
        return componentVisitors((name, fn) => {
            for (const param of fn.params) {
                if (param.type === 'Identifier' && param.typeAnnotation?.typeAnnotation?.type === 'TSTypeLiteral') {
                    context.report({
                        node: param,
                        message: `The component ${name} declares its props inline. Declare \`type ${name}Props = { … }\` above it and take \`props: ${name}Props\`.`,
                    });
                }
            }
        });
    },
};

export default {
    meta: { name: 'weighme' },
    rules: { 'no-destructured-component-props': rule, 'no-inline-component-props-type': inlineTypeRule },
};
