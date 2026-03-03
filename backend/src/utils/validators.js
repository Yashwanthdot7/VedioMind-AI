class Validators {
    static isValidYouTubeUrl(url) {
        const patterns = [
            /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+(&\S*)?$/,
            /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+$/,
            /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+$/
        ];

        return patterns.some(pattern => pattern.test(url));
    }

    static sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input.trim().replace(/[<>]/g, '');
    }
}

module.exports = Validators;