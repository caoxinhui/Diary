/**
 * 在一个每行都排好序（左边全是 0，右边全是 1）的 01 矩阵中，
 * 找到含 1 最多的那一行的行号；没有任何 1 时返回 -1。
 *
 * 思路：从右上角出发，遇到 1 就往左走（说明这一行 1 更多），遇到 0 就往下走。
 * 时间复杂度 O(行数 + 列数)。
 *
 * 运行：java MaxOneRow.java
 */
public class MaxOneRow {

    /** 原始版本（笔记里的写法，用 left 标记方向来回切换） */
    public static int getMaxOne(int[][] matrix) {
        if (matrix.length == 0 || matrix[0].length == 0) {
            return -1;
        }
        int i = 0;
        int j = matrix[0].length - 1;
        boolean left = true;
        while (i < matrix.length && j >= 0) {
            if (left) {
                while (j >= 0 && matrix[i][j] == 1) {
                    j--;
                }
                if (j == -1) {
                    return i;
                }
                left = false;
            } else {
                while (i < matrix.length && matrix[i][j] == 0) {
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

    /** 修正版本：每次成功左移时记录当前行，走到边界就返回记录值 */
    public static int getMaxOneFixed(int[][] matrix) {
        if (matrix == null || matrix.length == 0 || matrix[0].length == 0) {
            return -1;
        }
        int i = 0;
        int j = matrix[0].length - 1;
        int res = -1;
        while (i < matrix.length && j >= 0) {
            if (matrix[i][j] == 1) {
                res = i; // 第 i 行从 j 列到最右都是 1，是目前 1 最多的行
                j--;
            } else {
                i++;
            }
        }
        return res;
    }

    private static void test(String name, int[][] matrix, int expected) {
        int origin = getMaxOne(matrix);
        int fixed = getMaxOneFixed(matrix);
        System.out.printf("%-10s 期望=%2d  原始版本=%2d %s  修正版本=%2d %s%n",
                name, expected,
                origin, origin == expected ? "✔" : "✘",
                fixed, fixed == expected ? "✔" : "✘");
        for (int[] row : matrix) {
            System.out.println("             " + java.util.Arrays.toString(row));
        }
        System.out.println();
    }

    public static void main(String[] args) {
        test("用例1", new int[][]{{0, 0, 1}, {0, 1, 1}, {0, 0, 0}}, 1);
        test("用例2", new int[][]{{1, 1, 1}, {0, 0, 1}}, 0);
        test("用例3", new int[][]{{0, 0, 0}, {0, 0, 0}}, -1);
        test("用例4", new int[][]{{0, 1, 1}, {0, 0, 1}, {1, 1, 1}}, 2);
        test("用例5", new int[][]{{0, 0, 0, 1}, {0, 0, 1, 1}, {0, 1, 1, 1}, {0, 0, 0, 0}}, 2);
        test("空矩阵", new int[0][0], -1);
    }
}
