public static int getMaxOne(int[][] matrix) {
        if (matrix.length == 0 || matrix[0].length == 0) {
            return -1;
        }
        int i = 0;
        int j = matrix[0].length-1;
        boolean left = true;
        while (i < matrix.length && j >=0) {
            if (left) {
                while(j >= 0 && matrix[i][j] == 1) {
                    j--;
                }
                if (j == -1) {
                    return i;
                }
                left = false;
            } else {
                while(i < matrix.length && matrix[i][j] == 0 ) {
                    i++;
                }
                if (i == matrix.length) {
                    return -1;
                }
                left = true;
            }
        }
        return -1;
    }