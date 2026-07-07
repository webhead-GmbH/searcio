module.exports = {
	root: true,
	env: {
		browser: true,
		es2021: true,
		node: true,
	},
	extends: [
		"plugin:@wordpress/eslint-plugin/recommended",
		"plugin:react-hooks/recommended",
		"plugin:react/recommended",
	],
	parserOptions: {
		ecmaFeatures: {
			jsx: true,
		},
		ecmaVersion: "latest",
		sourceType: "module",
	},
	plugins: [
		"react",
		"react-hooks",
	],
	globals: {
		webheadToolkitAdminDetails: "readonly",
	},
	rules: {
		"react/react-in-jsx-scope": "off",
		"react/jsx-filename-extension": [1, {extensions: [".js", ".jsx"]}],
		"import/no-extraneous-dependencies": ["off", {devDependencies: true}],
		'react/prop-types': "off",
	},
};
