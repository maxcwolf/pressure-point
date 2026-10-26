// An ESLint rule that keeps the interface's styles on the theme (src/ui/theme/panda): a color is a semantic role, never
// a palette color or a hex value, and a size, a gap, a line or a weight is a token, never a number in brackets. Layout
// math (calc, min, max, clamp), percentages, sizes in em or of the window, and geometry such as grid templates and
// transforms are let through, since no theme has a token for them.

/** The palette's hues (palette.ts), which only the semantic roles may name. */
const PALETTE = [
  'white',
  'black',
  'navy',
  'cream',
  'grass',
  'teal',
  'cyan',
  'green',
  'gold',
  'orange',
  'red',
  'pink',
  'violet',
  'plum',
  'blue',
];

/** Properties that take a color. */
const COLOR_PROPS = new Set([
  'color',
  'bg',
  'bgColor',
  'background',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'outlineColor',
  'fill',
  'stroke',
  'accentColor',
  'caretColor',
  'textDecorationColor',
  'scrollbarColor',
]);

/** Properties whose values are geometry or effects rather than the theme's values. */
const FREE_PROPS = new Set([
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridTemplateAreas',
  'gridTemplate',
  'gridColumn',
  'gridRow',
  'gridArea',
  'gridAutoRows',
  'gridAutoColumns',
  'transform',
  'translate',
  'rotate',
  'scale',
  'filter',
  'backdropFilter',
  'content',
  'clipPath',
  'aspectRatio',
  'transformOrigin',
  'positionArea',
  'flex',
  'verticalAlign',
]);

/** Properties that take a timing, which must come from the theme's durations. */
const TIMED_PROPS = new Set(['animation', 'transition', 'animationDuration', 'transitionDuration']);

/** Calls whose objects are styles. */
const STYLE_CALLS = new Set([
  'css',
  'raw',
  'defineRecipe',
  'defineSlotRecipe',
  'defineGlobalStyles',
  'defineKeyframes',
]);

const HEX = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;
const PALETTE_REF = new RegExp(`\\{colors\\.(?:${PALETTE.join('|')})[.}]`);
const PALETTE_VALUE = new RegExp(`^(?:${PALETTE.join('|')})(?:[./]|$)`);

/**
 * A value with what can't hold a magic number taken out: data, references to tokens and custom properties, and layout
 * math (calc, min, max, clamp), whose numbers are the window's arithmetic rather than the theme's.
 */
function stripped(value) {
  let out = value
    .replace(/url\((?:[^()]|\([^)]*\))*\)/g, '')
    .replace(/\{[\w.-]+\}/g, '')
    .replace(/var\(--[\w-]+(?:,[^()]*)?\)/g, '');
  // the innermost first, so math nested in math comes out whole
  for (let before = ''; before !== out;) {
    before = out;
    out = out.replace(/\b(?:calc|min|max|clamp)\([^()]*\)/g, '');
  }
  return out;
}

/** What is wrong with `value` as the style property `prop`, or nothing. */
export function problem(prop, value) {
  if (HEX.test(value.replace(/url\((?:[^()]|\([^)]*\))*\)/g, '')))
    return 'Use a semantic color token, not a color value.';
  if (PALETTE_REF.test(value)) return 'Name a semantic color, not a palette color.';
  if (COLOR_PROPS.has(prop) && PALETTE_VALUE.test(value)) return 'Name a semantic color, not a palette color.';
  if (FREE_PROPS.has(prop) || prop.startsWith('--')) return undefined;
  const bracket = /^\[([\s\S]*)\]$/.exec(value);
  const body = stripped(bracket ? bracket[1] : value);
  if (TIMED_PROPS.has(prop))
    return /(?:^|\s)\d*\.?\d+m?s\b/.test(body) ? 'Use a duration token, not a time.' : undefined;
  // a length in pixels anywhere, or a bracket that is only a number
  if (
    /(?:^|[^\w.-])-?\d*\.?\d+px\b/.test(body) ||
    (bracket && /^\s*-?\d*\.?\d+\s*(?:!important)?\s*$/.test(body) && !/^\s*0\s*$/.test(body))
  ) {
    return 'Use a theme token, not a number.';
  }
  return undefined;
}

/** The name of a property's key, or nothing for a computed one. */
function keyName(property) {
  if (property.computed) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') return property.key.value;
  return undefined;
}

/** Whether `node` sits in a style object: an argument of a style call, or anywhere in one of the theme's own files. */
function inStyles(node, themeFile) {
  if (themeFile) return true;
  for (let at = node.parent; at; at = at.parent) {
    if (at.type === 'CallExpression') {
      const callee = at.callee.type === 'MemberExpression' ? at.callee.property : at.callee;
      return callee.type === 'Identifier' && STYLE_CALLS.has(callee.name);
    }
  }
  return false;
}

/** The string a literal holds, or nothing when it isn't a plain string. */
function text(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return undefined;
}

const rule = {
  meta: {
    type: 'problem',
    docs: { description: "Keeps the interface's styles on the theme's tokens" },
    schema: [{ type: 'object', properties: { themeFiles: { type: 'array', items: { type: 'string' } } } }],
  },
  /** Checks every style property, and every style prop on a Box. */
  create(context) {
    const filename = context.filename.replaceAll('\\', '/');
    const themeFile = (context.options[0]?.themeFiles ?? []).some((end) => filename.endsWith(end));
    /** Reports `node` if its value breaks the theme. */
    function check(node, prop, valueNode) {
      // a value chosen at run time by a ternary is checked branch by branch
      const values =
        valueNode.type === 'ConditionalExpression' ? [valueNode.consequent, valueNode.alternate] : [valueNode];
      for (const value of values) {
        const string = text(value);
        if (string === undefined) continue;
        const message = problem(prop, string);
        if (message) context.report({ node: value, message: `${message} (${prop}: '${string.slice(0, 40)}')` });
      }
    }
    return {
      /** A property of a style object. */
      Property(node) {
        const prop = keyName(node);
        if (prop && inStyles(node, themeFile)) check(node, prop, node.value);
      },
      /** A style prop on a Box. */
      JSXAttribute(node) {
        const element = node.parent.name;
        const name =
          element.type === 'JSXIdentifier'
            ? element.name
            : element.type === 'JSXMemberExpression'
              ? element.object.name
              : '';
        if (name !== 'Box' && name !== 'styled') return;
        if (node.name.type !== 'JSXIdentifier' || !node.value) return;
        const value = node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value;
        check(node, node.name.name, value);
      },
    };
  },
};

export default { rules: { tokens: rule } };
