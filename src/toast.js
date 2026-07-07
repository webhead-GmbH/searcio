import {Flip, toast} from 'react-toastify';

export const showToast = (message, type = 'success', customOptions = {}) => {
	let defaultOptions = {
		position: "top-right",
		autoClose: 5000,
		hideProgressBar: false,
		closeOnClick: false,
		pauseOnHover: true,
		draggable: true,
		progress: undefined,
		theme: "dark",
		role: "alert",
		ariaLabel: message,
		transition: Flip,
	};

	let options = {...defaultOptions, ...customOptions};

	switch (type) {
		case 'info':
			return toast.info(message, options);
		case 'error':
			return toast.error(message, options);
		case 'warning':
			return toast.warning(message, options);
		case 'success':
		default:
			return toast.success(message, options);
	}
};
