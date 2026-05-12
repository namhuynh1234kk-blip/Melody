-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 11, 2026 at 09:03 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `melodyvn`
--

-- --------------------------------------------------------

--
-- Table structure for table `favorites`
--

CREATE TABLE `favorites` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `song_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `favorites`
--

INSERT INTO `favorites` (`id`, `user_id`, `song_id`, `created_at`) VALUES
(2, 2, 0, '2026-05-11 04:09:43');

-- --------------------------------------------------------

--
-- Table structure for table `songs`
--

CREATE TABLE `songs` (
  `id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `artist` varchar(255) DEFAULT NULL,
  `src` text DEFAULT NULL,
  `cover` text DEFAULT NULL,
  `type` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `liked` tinyint(1) DEFAULT 0,
  `play_count` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `songs`
--

INSERT INTO `songs` (`id`, `title`, `artist`, `src`, `cover`, `type`, `created_at`, `liked`, `play_count`) VALUES
(1, 'Mưa Tuyết', 'Lưu Đức Hoa', 'https://www.youtube.com/watch?v=3WNy7isGkyg&list=RD3WNy7isGkyg&start_radio=1', 'https://picsum.photos/300?0.9547979065117936', 'youtube', '2026-05-08 04:28:02', 0, 7),
(2, 'Hạt mưa vương vấn', 'Kiều chi', 'https://youtu.be/UwDKu7VYtTw?si=zsQMhTorAOw-8BLv', 'https://picsum.photos/300?0.5152473085074627', 'youtube', '2026-05-08 04:36:03', 1, 2),
(4, 'Anh Không Theo Đuổi Em Nữa', 'Bùi Công Nam', 'https://www.youtube.com/watch?v=A-Ab7_R_P7k&list=RDA-Ab7_R_P7k&start_radio=1', 'https://picsum.photos/300?0.5152473085074628', 'youtube', '2026-05-08 08:52:36', 0, 3),
(6, 'Thắc mắc', 'Thịnh Suy', 'https://www.youtube.com/watch?v=YTQ-n0SgdiY&list=RDYTQ-n0SgdiY&start_radio=1', 'https://picsum.photos/300?0.6265754068950204', 'youtube', '2026-05-08 09:08:22', 1, 7),
(7, 'Người im lặng gặp người hay nói', 'HIEUTHUHAI', 'https://www.youtube.com/watch?v=8sVtL0o-v7U&list=RD8sVtL0o-v7U&start_radio=1', 'https://picsum.photos/300?sig=0.06779023932147155', 'youtube', '2026-05-11 01:51:17', 0, 10),
(8, 'Mùa mưa ấy', 'VŨ', 'https://www.youtube.com/watch?v=QQzt-veR3fY&list=RDQQzt-veR3fY&start_radio=1', 'https://picsum.photos/300?sig=0.7730273679795903', 'youtube', '2026-05-11 01:51:56', 1, 16);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role` enum('admin','user') DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `role`, `created_at`) VALUES
(1, 'admin', '123456', 'admin', '2026-05-11 03:02:36'),
(2, 'nam', '123', 'user', '2026-05-11 03:40:06'),
(3, 'tuan', '123', 'user', '2026-05-11 03:53:55'),
(4, 'Mi', '123', 'user', '2026-05-11 03:56:18');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `favorites`
--
ALTER TABLE `favorites`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `songs`
--
ALTER TABLE `songs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `favorites`
--
ALTER TABLE `favorites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `songs`
--
ALTER TABLE `songs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
